function toggleResultBox(visible) {
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = visible ? 'block' : 'none';
}


document.getElementById('scanForm').addEventListener('submit', async (event) => {
event.preventDefault();
const fileInput = document.getElementById('file');
const urlInput = document.getElementById('url');
const resultDiv = document.getElementById('result');

resultDiv.className = '';

if (!fileInput.files.length && !urlInput.value) {
    alert('Please select a file or enter a URL.');
    return;
}

const formData = new FormData();
if (fileInput.files.length) {
    formData.append('file', fileInput.files[0]);
} else {
    formData.append('url', urlInput.value);
}

try {
    resultDiv.innerHTML = 'Analyzing...';
    toggleResultBox(true);
    resultDiv.className = 'result analyzing';

    const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
    });

    if (response.ok) {
        const data = await response.json();
        const analysis_id = data.data.id;

        const analysisResult = await pollAnalysisStatus(analysis_id);
        const attributes = analysisResult.data.attributes;

        if (attributes) {
            const status = attributes.status;
            if (status === 'queued') {
                resultDiv.className = 'result info';
                resultDiv.innerHTML = 'The analysis is still in progress. Please wait and try again later.';
            } else {
                const engines = attributes.results;
                const totalEngines = Object.keys(engines).length;
                const maliciousEngines = Object.values(engines).filter(result => result.category === 'malicious').length;
                const ratioText = `${maliciousEngines} out of ${totalEngines} engines detected this as malicious.`;

                const detectedList = [];
                const undetectedList = [];

                Object.entries(engines).forEach(([engine, result]) => {
                    if (result.category === 'malicious') {
                        detectedList.push(`<li class="malicious"><span class="engine">${engine}:</span> ${result.result}</li>`);
                    } else {
                        undetectedList.push(`<li class="safe"><span class="engine">${engine}:</span> ${result.result}</li>`);
                    }
                });


                resultDiv.className = maliciousEngines > 0 ? 'result malicious' : 'result safe';
                resultDiv.innerHTML = `<div class="hashes">
                                          <p>MD5: ${attributes.md5}</p>
                                          <p>SHA256: ${attributes.sha256}</p>
                                        </div>
                                        <div class="ratio">
                                          <p>${ratioText}</p>
                                        </div>
                                        <div class="engine-results">
                                          <div class="detected">
                                            <h3>Detected</h3>
                                            <ul>${detectedList.join('')}</ul>
                                          </div>
                                          <div class="undetected">
                                            <h3>Undetected</h3>
                                            <ul>${undetectedList.join('')}</ul>
                                          </div>
                                        </div>`;
            }
        } else {
            resultDiv.className = 'result error';
            resultDiv.innerHTML = 'Error: Could not get the analysis attributes.';
        }

    } else {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = `Error: ${response.status} ${response.statusText}`;
    }
} catch (error) {
    resultDiv.className = 'result error';
    resultDiv.innerHTML = `Error: ${error.message}`;
}
});

async function pollAnalysisStatus(analysis_id) {
let analysisResult;
let isCompleted = false;
const pollingInterval = 5000;

while (!isCompleted) {
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
    analysisResult = await checkAnalysisStatus(analysis_id);

    if (analysisResult.data.attributes.status !== 'queued') {
        isCompleted = true;
    }
}

return analysisResult;
}

async function checkAnalysisStatus(analysis_id) {
const response = await fetch(`/analysis/${analysis_id}`, {
    method: 'GET',
});

if (response.ok) {
    return await response.json();
} else {
    throw new Error(`${response.status} ${response.statusText}`);
}
}
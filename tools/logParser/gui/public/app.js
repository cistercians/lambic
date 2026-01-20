const inputPathEl = document.getElementById('inputPath');
const configPathEl = document.getElementById('configPath');
const parseOutputEl = document.getElementById('parseOutput');
const runParseBtn = document.getElementById('runParse');

const fromDateEl = document.getElementById('fromDate');
const toDateEl = document.getElementById('toDate');
const metaOutputEl = document.getElementById('metaOutput');
const runMetaBtn = document.getElementById('runMeta');

function setOutput(element, message) {
  element.textContent = message;
}

async function runParse() {
  setOutput(parseOutputEl, 'Running parse...');
  try {
    const payload = {
      inputPath: inputPathEl.value.trim(),
      configPath: configPathEl.value.trim() || null
    };
    const response = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Parse failed');
    }
    setOutput(parseOutputEl, JSON.stringify(data, null, 2));
  } catch (error) {
    setOutput(parseOutputEl, `Error: ${error.message}`);
  }
}

async function runMeta() {
  setOutput(metaOutputEl, 'Generating meta report...');
  try {
    const payload = {
      from: fromDateEl.value.trim() || null,
      to: toDateEl.value.trim() || null
    };
    const response = await fetch('/api/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Meta report failed');
    }
    setOutput(metaOutputEl, JSON.stringify(data, null, 2));
  } catch (error) {
    setOutput(metaOutputEl, `Error: ${error.message}`);
  }
}

runParseBtn.addEventListener('click', runParse);
runMetaBtn.addEventListener('click', runMeta);

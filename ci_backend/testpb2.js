const axios = require('axios');
const fs = require('fs');

async function testPhantomBuster() {
  try {
    const apiUrl = 'https://api.phantombuster.com/api/v2';
    const agentId = '1027949591787320';
    const apiKey = 'hoeWRXj4Yhmul7eIyl2JCLFAA5qdmZm6gRxQe6sUbLI';
    const linkedInUrl = 'https://www.linkedin.com/in/saranya-muruganantham/';

    console.log('Launching PhantomBuster with "argument"...');
    const launchRes = await axios.post(
      `${apiUrl}/agents/launch`,
      {
        id: agentId,
        argument: {
          profileUrls: [linkedInUrl],
          spreadsheetUrl: linkedInUrl
        }
      },
      {
        headers: { 
          'x-phantombuster-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const containerId = launchRes.data.containerId;
    console.log(`Agent launched successfully. Container ID: ${containerId}`);

    let attempts = 0;
    while (attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const statusRes = await axios.get(`${apiUrl}/containers/fetch`, {
        params: { id: containerId },
        headers: { 'x-phantombuster-key': apiKey }
      });

      const status = statusRes.data.status;
      if (status === 'finished') {
        console.log(`Container finished.`);
        const outputRes = await axios.get(`${apiUrl}/containers/fetch-output`, {
          params: { id: containerId },
          headers: { 'x-phantombuster-key': apiKey }
        });
        
        let outData = null;
        if (outputRes.data.outputUrl) {
          const jsonRes = await axios.get(outputRes.data.outputUrl);
          outData = jsonRes.data;
        } else if (outputRes.data.resultObject) {
          outData = outputRes.data.resultObject;
        } else {
          outData = outputRes.data;
        }
        
        fs.writeFileSync('pb_result2.json', JSON.stringify(outData, null, 2), 'utf8');
        console.log('Wrote to pb_result2.json');
        break;
      } else if (status === 'error' || status === 'canceled') {
        console.log(`Container failed or was canceled. Status: ${status}`);
        break;
      }
      
      attempts++;
    }
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testPhantomBuster();

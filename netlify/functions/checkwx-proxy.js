const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const checkWxEndpoint = event.queryStringParameters.endpoint;
  const apiKey = process.env.CHECKWX_API_KEY;

  if (!checkWxEndpoint) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing target endpoint parameter' })
    };
  }

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CheckWX API Key is not configured in Netlify environment variables' })
    };
  }

  const targetUrl = `https://api.checkwx.com${decodeURIComponent(checkWxEndpoint)}`;
  console.log(`Proxy function calling: ${targetUrl}`); // Log the target URL

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
       console.error(`CheckWX API Error (${response.status}):`, data);
       // Forward the CheckWX error status and message if possible
       return {
         statusCode: response.status,
         body: JSON.stringify({ error: data.error || `CheckWX API request failed with status ${response.status}` })
       };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error in proxy function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error in proxy function', details: error.message })
    };
  }
};

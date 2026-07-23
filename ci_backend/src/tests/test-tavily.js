async function searchTavily(query) {
    const url = 'https://api.tavily.com/search';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: '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',
        query,
        search_depth: 'basic',
      }),
    });
    console.log(response.status);
    console.log(await response.text());
}
searchTavily('site:linkedin.com/in "Kanishka Ramakrishnan"');

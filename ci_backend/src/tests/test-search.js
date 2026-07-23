const cheerio = require('cheerio');
async function searchFallback(query) {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    $('.result').each((_, el) => {
      const title = $(el).find('.result__title a').text().trim();
      const href = $(el).find('.result__title a').attr('href');
      if (title && href) results.push(title);
    });
    console.log("Query:", query);
    console.log(results);
}
async function main() {
  await searchFallback('site:linkedin.com/in "Kanishka Ramakrishnan" "Cloud Destinations"');
  await searchFallback('site:linkedin.com/in "Kanishka Ramakrishnan"');
  await searchFallback('site:linkedin.com/in Kanishka Ramakrishnan');
}
main();

async function run() {
  const query = 'site:linkedin.com/in "JEGADHEES J" "CLOUD DESTINATIONS"';
  const res = await fetch('https://search.yahoo.com/search?p=' + encodeURIComponent(query), { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' } });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Length:', text.length);
}
run();

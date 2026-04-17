const https = require('https');
const fs = require('fs');

const USERNAME = process.env.GITHUB_USERNAME || 'Ayushpersonal';
const TOKEN = process.env.GH_TOKEN;

const year = new Date().getFullYear();
const FROM = `${year}-01-01T00:00:00Z`;
const TO   = `${year}-12-31T23:59:59Z`;

const query = `query($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionCount
          }
        }
      }
    }
  }
}`;

function fetchContributions() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query,
      variables: { username: USERNAME, from: FROM, to: TO }
    });

    const req = https.request({
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'space-invaders-gen'
      }
    }, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          if (parsed.errors) {
            console.error('❌ GraphQL errors:', JSON.stringify(parsed.errors, null, 2));
            process.exit(1);
          }

          if (!parsed.data || !parsed.data.user) {
            console.error('❌ Invalid response:', JSON.stringify(parsed, null, 2));
            process.exit(1);
          }

          resolve(parsed);
        } catch (err) {
          console.error('❌ JSON Parse Error:', err);
          console.error('Raw response:', data);
          process.exit(1);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Color helpers
function getColor(n) {
  if (n === 0) return '#1a2332';
  if (n < 2)   return '#0d4a2a';
  if (n < 5)   return '#1a7a3a';
  if (n < 10)  return '#26c050';
  if (n < 20)  return '#39e85a';
  return '#57ff7a';
}

function getBorder(n) {
  if (n === 0) return '#243040';
  if (n < 5)   return '#1e6b33';
  return '#2dba4e';
}

function generateSVG(weeksRaw) {
  const cs = 13, gap = 3, step = cs + gap;
  const cols = weeksRaw.length, rows = 7;
  const pl = 24, pt = 80;
  const W = cols * step + pl * 2;
  const H = rows * step + pt + 28;

  const cells = [];
  weeksRaw.forEach((week, col) => {
    week.contributionDays.forEach((day, row) => {
      cells.push({ x: pl + col * step, y: pt + row * step, count: day.contributionCount });
    });
  });

  const gridSVG = cells.map(cell => {
    const fill = getColor(cell.count);
    const stroke = getBorder(cell.count);

    return `<rect x="${cell.x}" y="${cell.y}" width="${cs}" height="${cs}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="0.4"/>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${gridSVG}
    <text x="${W - 20}" y="${H - 10}" text-anchor="end" font-size="12" fill="#9b5de5">
      ${year} contributions
    </text>
  </svg>`;
}

async function main() {
  console.log(`🚀 Fetching ${year} contributions for ${USERNAME}`);

  if (!TOKEN) {
    console.error('❌ Missing GH_TOKEN');
    process.exit(1);
  }

  const result = await fetchContributions();
  const weeks = result.data.user.contributionsCollection.contributionCalendar.weeks;

  const svg = generateSVG(weeks);

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/space-invaders.svg', svg);

  console.log('✅ SVG generated successfully');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

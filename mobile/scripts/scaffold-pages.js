// Eksik sayfa dosyaları için geçici iskelet üretir (var olan dosyaya dokunmaz).
const fs = require('fs');
const path = require('path');
const { ROUTES } = require('./routes.json');

const base = path.join(__dirname, '..', 'src', 'app');
for (const r of ROUTES) {
  const file = path.join(base, `${r}.tsx`);
  if (fs.existsSync(file)) continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const isLayout = r.endsWith('_layout');
  const isTab = r.startsWith('(tabs)/');
  const body = isLayout
    ? `import { Stack } from 'expo-router';\n\nexport default function Layout() {\n  return <Stack screenOptions={{ headerShown: false }} />;\n}\n`
    : `import { Screen, Header } from '@/components';\n\nexport default function Page() {\n  return (\n    <Screen>\n      <Header title="${r}" back={${!isTab}} />\n    </Screen>\n  );\n}\n`;
  fs.writeFileSync(file, body);
  console.log('created', r);
}

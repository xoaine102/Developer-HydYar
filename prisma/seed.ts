// Idempotent seed: clears mutable content tables (keeps User accounts — admin is
// created only via register, never faked), then inserts 3 chat rooms and docs.
// Tries to import real content from @hydyar/docs-data (written by the docs-data
// agent); ALWAYS falls back to inline content so `npx tsx prisma/seed.ts` works
// even when that package is absent or empty.
//
// Run from project root:  npx tsx prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "doc"
  );
}

interface SeedLearning {
  lang: string;
  slug: string;
  title: string;
  level?: string;
  orderIdx: number;
  summary?: string;
  content: string;
  related?: string;
}
interface SeedAppEntry {
  lang: string;
  category: string;
  component: string;
  rule: string;
  explanation: string;
  example: string;
  exampleNote?: string;
  orderIdx: number;
}

// ---------------- Inline fallback (always works) ----------------
const FALLBACK_LEARNING: SeedLearning[] = [
  {
    lang: "javascript",
    slug: "gioi-thieu-javascript",
    title: "Giới thiệu JavaScript",
    level: "beginner",
    orderIdx: 0,
    summary: "JavaScript là ngôn ngữ lập trình chính của web — chạy được trên trình duyệt và cả server (Node.js).",
    content: `# Giới thiệu JavaScript

JavaScript (JS) là ngôn ngữ lập trình thông dịch, chạy được trên **trình duyệt** và trên **server** nhờ Node.js.

## Chạy đoạn code đầu tiên

\`\`\`javascript
console.log("Xin chào, HydYar!");
const name = "Developer";
console.log("Chào mừng", name);
\`\`\`

Mở tab Console trong DevTools (F12) hoặc dùng IDE trên HydYar để chạy.

## Đặc điểm chính
- Động kiểu (dynamic typing): một biến có thể chứa bất kỳ kiểu giá trị nào.
- Hỗ trợ lập trình hướng sự kiện và bất đồng bộ (async/await, Promise).
- Hệ sinh thái khổng lồ qua npm.

## Bài tập
Hãy in ra màn hình dòng chữ \`Tôi đang học JavaScript\`.`,
    related: "bien-va-kieu-du-lieu,ham-va-dieu-khien",
  },
  {
    lang: "javascript",
    slug: "bien-va-kieu-du-lieu",
    title: "Biến và kiểu dữ liệu",
    level: "beginner",
    orderIdx: 1,
    summary: "let, const, var; các kiểu nguyên thủy number, string, boolean, null, undefined và object.",
    content: `# Biến và kiểu dữ liệu

## Khai báo biến
- \`let\` — biến có thể gán lại.
- \`const\` — hằng số, không gán lại được.
- \`var\` — cũ, phạm vi hàm; tránh dùng.

\`\`\`javascript
let age = 25;
age = 26; // OK
const PI = 3.14;
// PI = 3; // Lỗi!
\`\`\`

## Kiểu dữ liệu nguyên thủy
\`number\`, \`string\`, \`boolean\`, \`null\`, \`undefined\`, \`symbol\`, \`bigint\`.

\`\`\`javascript
typeof 42;        // "number"
typeof "hello";   // "string"
typeof true;      // "boolean"
typeof undefined; // "undefined"
\`\`\`

## Ép kiểu
\`String(123)\`, \`Number("45")\`, \`Boolean(0)\` (false). Dùng \`===\` để so sánh cả kiểu và giá trị.`,
    related: "gioi-thieu-javascript,ham-va-dieu-khien",
  },
  {
    lang: "javascript",
    slug: "ham-va-dieu-khien",
    title: "Hàm và điều khiển luồng",
    level: "beginner",
    orderIdx: 2,
    summary: "Khai báo hàm, arrow function, if/else, vòng lặp for/while và return.",
    content: `# Hàm và điều khiển luồng

## Hàm (function)
\`\`\`javascript
function sum(a, b) {
  return a + b;
}
const multiply = (a, b) => a * b; // arrow function
console.log(sum(2, 3));      // 5
console.log(multiply(2, 3)); // 6
\`\`\`

## Điều kiện if/else
\`\`\`javascript
const score = 8;
if (score >= 9) console.log("Xuất sắc");
else if (score >= 5) console.log("Đạt");
else console.log("Chưa đạt");
\`\`\`

## Vòng lặp
\`\`\`javascript
for (let i = 0; i < 3; i++) console.log(i); // 0 1 2
let n = 3;
while (n > 0) { console.log(n); n--; }
\`\`\`

## Bài tập
Viết hàm \`isEven(n)\` trả về \`true\` nếu n là số chẵn.`,
    related: "gioi-thieu-javascript,bien-va-kieu-du-lieu",
  },
  {
    lang: "python",
    slug: "python-co-ban",
    title: "Python cơ bản",
    level: "beginner",
    orderIdx: 0,
    summary: "Cú pháp Python, biến, hàm print và kiểu dữ liệu cơ bản.",
    content: `# Python cơ bản

Python nổi tiếng với cú pháp **sạch, dễ đọc**, dùng thụt lề (indentation) thay vì dấu ngoặc.

\`\`\`python
name = "HydYar"
print("Xin chào,", name)

age = 2026 - 2019
print("Tuổi:", age)
\`\`\`

## Kiểu dữ liệu
\`int\`, \`float\`, \`str\`, \`bool\`, \`list\`, \`dict\`.

\`\`\`python
numbers = [1, 2, 3]
person = {"name": "An", "age": 20}
print(numbers[0], person["name"])
\`\`\``,
  },
  {
    lang: "python",
    slug: "ham-trong-python",
    title: "Hàm và vòng lặp trong Python",
    level: "beginner",
    orderIdx: 1,
    summary: "def, if/elif/else, for/in, while.",
    content: `# Hàm và vòng lặp trong Python

\`\`\`python
def greet(name, times=1):
    for i in range(times):
        print(f"Xin chào {name} lần {i+1}")

greet("Bạn", 3)

n = 5
while n > 0:
    print(n)
    n -= 1
\`\`\`

Lưu ý: dấu \`:\` cuối dòng và thụt lề 4 khoảng trắng là bắt buộc.`,
  },
];

const FALLBACK_APPS: SeedAppEntry[] = [
  { lang: "javascript", category: "syntax", component: "let x = 1;", rule: "Khai báo biến có thể gán lại; phạm vi khối (block scope). Không dùng trước khi khai báo (TDZ).", explanation: "let tạo biến gán lại được trong cặp ngoặc {} gần nhất.", example: "let count = 0;\ncount = count + 1;\nconsole.log(count); // 1", exampleNote: "count có thể thay đổi", orderIdx: 0 },
  { lang: "javascript", category: "syntax", component: "const PI = 3.14;", rule: "Hằng số, không gán lại được. Bắt buộc khởi tạo giá trị ngay. Object/array vẫn có thể mutate nội bộ.", explanation: "const chặn việc gán lại tên biến, không chặn thay đổi thuộc tính của object.", example: "const user = { name: 'An' };\nuser.name = 'Bình'; // OK\n// user = {}; // Lỗi", orderIdx: 1 },
  { lang: "javascript", category: "operators", component: "a + b, a - b, a * b, a / b, a % b", rule: "Phép toán số học cơ bản. + cũng nối chuỗi nếu một vế là string. % là chia lấy dư.", explanation: "Dùng để tính toán; lưu ý kiểu tự động ép khi trộn string và number.", example: "console.log(7 % 2);   // 1\nconsole.log('5' + 3); // '53'\nconsole.log('5' - 3); // 2", exampleNote: "'5' + 3 → nối chuỗi", orderIdx: 0 },
  { lang: "javascript", category: "operators", component: "=== và !==", rule: "So sánh nghiêm ngặt: cùng kiểu và cùng giá trị. Tránh == vì ép kiểu tự động gây lỗi.", explanation: "=== không ép kiểu, kết quả dự đoán được.", example: "console.log(5 === '5'); // false\nconsole.log(5 == '5');  // true (tránh)", orderIdx: 1 },
  { lang: "javascript", category: "functions", component: "function fn(a, b) { return a + b; }", rule: "Khai báo hàm truyền thống; được hoisted (gọi trước khi khai báo được). return trả về giá trị.", explanation: "Hàm là khối code tái sử dụng, nhận tham số và trả về kết quả.", example: "function add(a, b) {\n  return a + b;\n}\nconsole.log(add(2, 3)); // 5", orderIdx: 0 },
  { lang: "javascript", category: "functions", component: "const f = (a, b) => a + b;", rule: "Arrow function: ngắn gọn, không có this riêng. Bỏ qua return khi chỉ có một biểu thức.", explanation: "Thường dùng cho callback và hàm một dòng.", example: "const double = n => n * 2;\nconsole.log(double(4)); // 8\n[1,2,3].map(double); // [2,4,6]", orderIdx: 1 },
  { lang: "javascript", category: "arrays", component: "arr.push(x), arr.pop(), arr.map(fn), arr.filter(fn)", rule: "push thêm cuối, pop bỏ cuối. map tạo mảng mới qua hàm, filter lọc theo điều kiện.", explanation: "Các method phổ biến nhất của mảng; map/filter không sửa mảng gốc.", example: "const nums = [1,2,3,4];\nconst evens = nums.filter(n => n % 2 === 0);\nconst doubled = nums.map(n => n * 2);\nconsole.log(evens, doubled); // [2,4] [2,4,6,8]", orderIdx: 0 },
  { lang: "javascript", category: "async", component: "await fetch(url); (trong async function)", rule: "await tạm dừng hàm async cho đến khi Promise resolve. Bắt lỗi bằng try/catch.", explanation: "Giúp code bất đồng bộ đọc dễ dàng như đồng bộ.", example: "async function getUser(id) {\n  const res = await fetch(`/api/users/${id}`);\n  return res.json();\n}", exampleNote: "Hàm chứa await phải khai báo async", orderIdx: 0 },
  { lang: "python", category: "syntax", component: "x = 1", rule: "Không cần khai báo kiểu; không có từ khóa let/const. Thụt lề 4 spaces định nghĩa khối.", explanation: "Python tự suy kiểu theo giá trị gán.", example: "name = 'HydYar'\nage = 7\nprint(name, age)", orderIdx: 0 },
  { lang: "python", category: "functions", component: "def fn(a, b=1): return a + b", rule: "def khai báo hàm; tham số mặc định dùng =. return trả về giá trị.", explanation: "Tham số mặc định phải đứng sau tham số bắt buộc.", example: "def power(base, exp=2):\n    return base ** exp\nprint(power(3))    # 9\nprint(power(3, 3)) # 27", orderIdx: 0 },
  { lang: "python", category: "collections", component: "lst = [1, 2, 3]; d = {'a': 1}", rule: "list dùng [], truy cập theo index. dict dùng {}, truy cập theo key.", explanation: "Hai cấu trúc dữ liệu dùng nhiều nhất trong Python.", example: "fruits = ['tao', 'le', 'xoai']\nprint(fruits[0])       # tao\ninfo = {'ten': 'An', 'tuoi': 20}\nprint(info['ten'])     # An", orderIdx: 0 },
  { lang: "python", category: "loops", component: "for x in iterable: / while cond:", rule: "for duyệt qua từng phần tử. while lặp khi điều kiện còn đúng. Thụt lề bắt buộc.", explanation: "range(n) sinh số từ 0 đến n-1.", example: "for i in range(3):\n    print(i)  # 0 1 2\nn = 2\nwhile n >= 0:\n    print(n); n -= 1", orderIdx: 0 },
];

// ---------------- External docs-data import (best effort) ----------------
async function loadExternalDocs(): Promise<{ learning: SeedLearning[]; apps: SeedAppEntry[] } | null> {
  try {
    // The docs-data agent may publish '@hydyar/docs-data' and/or a root re-export.
    const candidates: string[] = ["@hydyar/docs-data", "../prisma/seed-data.ts", "../prisma/seed-data.js"];
    for (const spec of candidates) {
      try {
        const mod: Record<string, unknown> = await import(spec);
        const learning = pickArray<SeedLearning>(mod, ["learningDocs", "learning", "docs", "seedLearning"]);
        const apps = pickArray<SeedAppEntry>(mod, ["appEntries", "applications", "entries", "seedApps", "appDocs"]);
        const nested = mod.seedData as Record<string, unknown> | undefined;
        const nestedLearning = nested ? pickArray<SeedLearning>(nested, ["learningDocs", "learning", "docs"]) : [];
        const nestedApps = nested ? pickArray<SeedAppEntry>(nested, ["appEntries", "applications", "entries"]) : [];
        const L = learning.length ? learning : nestedLearning;
        const A = apps.length ? apps : nestedApps;
        if (L.length || A.length) {
          console.log(`[seed] loaded external docs from ${spec}: ${L.length} learning, ${A.length} app entries`);
          return { learning: L, apps: A };
        }
      } catch {
        /* try next candidate */
      }
    }
  } catch {
    /* fall through to inline */
  }
  return null;
}

function pickArray<T>(obj: Record<string, unknown>, keys: string[]): T[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) return v as T[];
  }
  return [];
}

async function main() {
  console.log("[seed] clearing content tables (users are preserved)...");
  // Order matters: dependents first.
  await prisma.chatMessage.deleteMany();
  await prisma.postReport.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.forumPost.deleteMany();
  await prisma.docSuggestion.deleteMany();
  await prisma.favoriteDoc.deleteMany();
  await prisma.learningProgress.deleteMany();
  await prisma.executionLog.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.project.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.learningDoc.deleteMany();
  await prisma.appDocEntry.deleteMany();
  await prisma.chatRoom.deleteMany();

  console.log("[seed] inserting 3 chat rooms...");
  const rooms = [
    { name: "chung", description: "Kênh chung — trò chuyện, hỏi đáp mọi chủ đề." },
    { name: "javascript", description: "JavaScript, TypeScript, Node.js, frontend." },
    { name: "python", description: "Python, dữ liệu, automation, backend." },
  ];
  for (const r of rooms) {
    await prisma.chatRoom.create({ data: r });
  }

  const external = await loadExternalDocs();
  const learning = external?.learning.length ? external.learning : FALLBACK_LEARNING;
  const apps = external?.apps.length ? external.apps : FALLBACK_APPS;
  if (!external) console.log("[seed] @hydyar/docs-data not found or empty — using inline fallback docs.");

  console.log(`[seed] inserting ${learning.length} learning docs...`);
  for (const d of learning) {
    await prisma.learningDoc.upsert({
      where: { lang_slug: { lang: d.lang, slug: d.slug ?? slugify(d.title) } },
      update: { title: d.title, content: d.content, summary: d.summary ?? null, level: d.level ?? "beginner", orderIdx: d.orderIdx, related: d.related ?? null },
      create: { lang: d.lang, slug: d.slug ?? slugify(d.title), title: d.title, content: d.content, summary: d.summary ?? null, level: d.level ?? "beginner", orderIdx: d.orderIdx, related: d.related ?? null },
    });
  }

  console.log(`[seed] inserting ${apps.length} application entries...`);
  for (const e of apps) {
    await prisma.appDocEntry.create({
      data: {
        lang: e.lang,
        category: e.category,
        component: e.component,
        rule: e.rule,
        explanation: e.explanation,
        example: e.example,
        exampleNote: e.exampleNote ?? null,
        orderIdx: e.orderIdx,
      },
    });
  }

  console.log("[seed] done.");
}

main()
  .catch((e) => {
    console.error("[seed] FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const clientDir = path.join(root, "client");
const serverDir = path.join(root, "server");
const publicDir = path.join(serverDir, "public");
const cloudflaredPath = path.join(serverDir, "bin", "cloudflared.exe");
const outDir = path.join(root, "SimpleWorkFlow-dist");

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log("1/3 클라이언트 빌드 중...");
run("npm run build", clientDir);

console.log("2/3 빌드 결과를 server/public으로 복사 중...");
fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(path.join(clientDir, "dist"), publicDir, { recursive: true });

if (!fs.existsSync(cloudflaredPath)) {
  console.error(
    `server/bin/cloudflared.exe가 없습니다. https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe 를 받아 그 경로에 두세요.`
  );
  process.exit(1);
}

console.log("3/3 exe 패키징 중 (시간이 걸릴 수 있습니다)...");
fs.mkdirSync(outDir, { recursive: true });
run(`npx --yes @yao-pkg/pkg . --targets node22-win-x64 --output "${path.join(outDir, "SimpleWorkFlow.exe")}"`, serverDir);

console.log(`\n완료: ${path.join(outDir, "SimpleWorkFlow.exe")}`);

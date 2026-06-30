const { execSync } = require("child_process");

function main() {
  const ourPid = process.pid;
  const parentPid = process.ppid;
  console.log("Our PID:", ourPid, "Parent PID:", parentPid);

  const output = execSync("tasklist /fo csv /nh").toString();
  const lines = output.split("\n");

  for (const line of lines) {
    if (!line.includes("node.exe")) continue;
    const parts = line.split('","');
    if (parts.length < 2) continue;
    const name = parts[0].replace(/"/g, "");
    const pidStr = parts[1].replace(/"/g, "");
    const pid = parseInt(pidStr, 10);

    if (pid !== ourPid && pid !== parentPid) {
      console.log(`Killing process ${pid}...`);
      try {
        execSync(`taskkill /f /pid ${pid}`);
        console.log(`Killed ${pid} successfully.`);
      } catch (e) {
        console.error(`Failed to kill ${pid}:`, e.message);
      }
    }
  }
}

main();

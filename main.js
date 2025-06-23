const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Android CPU Controller',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ADB命令执行函数
function executeADBCommand(command, callback) {
  exec(`adb ${command}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`ADB命令执行错误: ${error.message}`);
      callback(error, null);
      return;
    }
    if (stderr) {
      console.error(`ADB错误输出: ${stderr}`);
      callback(stderr, null);
      return;
    }
    callback(null, stdout);
  });
}

// 获取连接的设备列表
ipcMain.on('get-connected-devices', (event) => {
  executeADBCommand('devices', (error, output) => {
    if (error) {
      event.reply('device-list', { error: '无法获取设备列表，请确保ADB已正确安装并启动' });
      return;
    }

    const devices = output
      .split('\n')
      .filter(line => line.includes('device') && !line.includes('List of devices'))
      .map(line => line.split('\t')[0]);

    event.reply('device-list', { devices });
  });
});

// 获取CPU信息
ipcMain.on('get-cpu-info', (event, deviceId) => {
  // 获取CPU核心数
  executeADBCommand(`-s ${deviceId} shell cat /proc/cpuinfo | grep 'processor' | wc -l`, (error, coreCount) => {
    if (error) {
      event.reply('cpu-info', { error: '获取CPU核心数失败' });
      return;
    }

    // 获取CPU频率信息
    executeADBCommand(`-s ${deviceId} shell cat /sys/devices/system/cpu/cpu*/cpufreq/cpuinfo_max_freq`, (error, maxFreqOutput) => {
      if (error) {
        event.reply('cpu-info', { error: '获取CPU频率信息失败' });
        return;
      }

      const maxFrequencies = maxFreqOutput
        .split('\n')
        .filter(freq => freq.trim() !== '')
        .map(freq => parseInt(freq) / 1000000); // 转换为GHz

      // 获取CPU集群信息（简化版，实际需要更复杂的解析）
      const clusterInfo = getClusterInfo(maxFrequencies);

      event.reply('cpu-info', {
        coreCount: parseInt(coreCount),
        maxFrequencies,
        clusterInfo
      });
    });
  });
});

// 简单的CPU集群检测逻辑
function getClusterInfo(frequencies) {
  if (!frequencies || frequencies.length === 0) return [];

  // 按频率排序并分组
  const sorted = [...frequencies].sort((a, b) => b - a);
  const uniqueFreqs = [...new Set(sorted)].sort((a, b) => b - a);

  // 简单分为大中小核（实际设备可能有不同的集群划分方式）
  const clusters = uniqueFreqs.map((freq, index) => {
    const count = sorted.filter(f => f === freq).length;
    const type = index === 0 ? '大核' : index === 1 ? '中核' : '小核';
    return { type, count, frequency: freq.toFixed(2) };
  });

  return clusters;
}
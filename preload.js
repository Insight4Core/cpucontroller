const { ipcRenderer, contextBridge } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => {
    // 白名单验证，只允许特定通道的通信
    const validChannels = ['get-connected-devices', 'get-cpu-info'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    const validChannels = ['device-list', 'cpu-info'];
    if (validChannels.includes(channel)) {
      // 避免泄露原始事件对象
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  once: (channel, func) => {
    const validChannels = ['cpu-info'];
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    }
  }
});
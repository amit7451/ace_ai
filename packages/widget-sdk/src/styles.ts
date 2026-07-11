export const widgetStyles = `
  :host {
    --primary-color: #3b82f6;
    --primary-hover: #2563eb;
    --bg-color: #ffffff;
    --text-color: #1f2937;
    --border-color: #e5e7eb;
    --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .ion-widget-launcher {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    border-radius: 30px;
    background: var(--primary-color);
    color: white;
    border: none;
    cursor: pointer;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, background-color 0.2s;
    z-index: 999999;
  }

  .ion-widget-launcher:hover {
    transform: scale(1.05);
    background: var(--primary-hover);
  }

  .ion-widget-container {
    position: fixed;
    bottom: 100px;
    right: 24px;
    width: 400px;
    height: 600px;
    max-height: calc(100vh - 120px);
    max-width: calc(100vw - 48px);
    background: var(--bg-color);
    border-radius: 16px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: translateY(20px);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s;
    z-index: 999999;
  }

  .ion-widget-container.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }

  .ion-widget-header {
    background: var(--primary-color);
    color: white;
    padding: 16px 20px;
    font-weight: 600;
    font-size: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ion-widget-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    opacity: 0.8;
  }
  
  .ion-widget-close:hover { opacity: 1; }

  .ion-widget-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ion-message {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 12px;
    line-height: 1.5;
    font-size: 14px;
  }

  .ion-message.user {
    background: var(--primary-color);
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }

  .ion-message.assistant {
    background: #f3f4f6;
    color: var(--text-color);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }
  
  .ion-message.assistant p { margin: 0 0 8px 0; }
  .ion-message.assistant p:last-child { margin: 0; }
  .ion-message.assistant pre { background: #e5e7eb; padding: 8px; border-radius: 4px; overflow-x: auto; }

  .ion-widget-input-area {
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 8px;
  }

  .ion-widget-input {
    flex: 1;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .ion-widget-input:focus {
    border-color: var(--primary-color);
  }

  .ion-widget-send {
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 8px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .ion-widget-send:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .ion-widget-send:hover:not(:disabled) {
    background: var(--primary-hover);
  }
`;

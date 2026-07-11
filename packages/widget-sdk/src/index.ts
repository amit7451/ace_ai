import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { widgetStyles } from './styles';

export interface WidgetConfig {
  widgetKey: string;
  apiBaseUrl?: string;
  title?: string;
}

export class IonWidget {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private isOpen = false;
  private messages: any[] = [];
  private conversationId?: string;

  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private containerEl!: HTMLDivElement;

  constructor(private config: WidgetConfig) {
    this.config.apiBaseUrl = this.config.apiBaseUrl || 'http://localhost:3001/api/v1';

    this.container = document.createElement('div');
    // Using closed shadow root isolates the styles from the host page
    this.shadow = this.container.attachShadow({ mode: 'closed' });
    document.body.appendChild(this.container);

    this.render();
    this.attachListeners();
  }

  private render() {
    const style = document.createElement('style');
    style.textContent = widgetStyles;
    this.shadow.appendChild(style);

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'ion-widget-container';

    this.containerEl.innerHTML = `
      <div class="ion-widget-header">
        <span>${this.config.title || 'Support Assistant'}</span>
        <button class="ion-widget-close" aria-label="Close chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="ion-widget-messages"></div>
      <div class="ion-widget-input-area">
        <input type="text" class="ion-widget-input" placeholder="Type your message..." />
        <button class="ion-widget-send" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    `;

    const launcher = document.createElement('button');
    launcher.className = 'ion-widget-launcher';
    launcher.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

    this.shadow.appendChild(this.containerEl);
    this.shadow.appendChild(launcher);

    this.messagesEl = this.containerEl.querySelector('.ion-widget-messages') as HTMLDivElement;
    this.inputEl = this.containerEl.querySelector('.ion-widget-input') as HTMLInputElement;
    this.sendBtn = this.containerEl.querySelector('.ion-widget-send') as HTMLButtonElement;

    // Default welcome message
    this.addMessage('assistant', 'Hi there! How can I help you today?');
  }

  private attachListeners() {
    const launcher = this.shadow.querySelector('.ion-widget-launcher');
    const closeBtn = this.shadow.querySelector('.ion-widget-close');

    launcher?.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.toggle());

    this.inputEl.addEventListener('input', () => {
      this.sendBtn.disabled = this.inputEl.value.trim().length === 0;
    });

    this.inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.sendBtn.disabled) {
        this.sendMessage();
      }
    });

    this.sendBtn.addEventListener('click', () => this.sendMessage());
  }

  public toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.containerEl.classList.add('open');
      setTimeout(() => this.inputEl.focus(), 300);
    } else {
      this.containerEl.classList.remove('open');
    }
  }

  private addMessage(role: 'user' | 'assistant', content: string, id?: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `ion-message ${role}`;
    if (id) el.id = id;

    if (role === 'assistant') {
      const html = DOMPurify.sanitize(marked.parse(content) as string);
      el.innerHTML = html;
    } else {
      el.textContent = content;
    }

    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return el;
  }

  private updateMessage(el: HTMLElement, content: string) {
    el.innerHTML = DOMPurify.sanitize(marked.parse(content) as string);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private async sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.inputEl.disabled = true;

    this.addMessage('user', text);
    const responseEl = this.addMessage('assistant', '...', `msg-${Date.now()}`);
    let fullResponse = '';

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetKey: this.config.widgetKey,
          conversationId: this.conversationId,
          message: text,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'metadata' && data.conversationId) {
                this.conversationId = data.conversationId;
              } else if (data.type === 'chunk' && data.content) {
                if (fullResponse === '') responseEl.innerHTML = '';
                fullResponse += data.content;
                this.updateMessage(responseEl, fullResponse);
              } else if (data.type === 'error') {
                this.updateMessage(responseEl, fullResponse + '\n\n*Error: ' + data.error + '*');
              }
            } catch (e) {
              console.error('Failed to parse SSE data', dataStr);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      this.updateMessage(responseEl, 'Sorry, something went wrong while processing your request.');
    } finally {
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
  }
}

/**
 * Chat UI — Multiplayer text chat overlay
 */

export interface ChatMessage {
  playerName: string;
  message: string;
  timestamp: number;
}

export class ChatUI {
  private container: HTMLDivElement;
  private messagesContainer!: HTMLDivElement;
  private input!: HTMLInputElement;
  private messages: ChatMessage[] = [];
  private _visible = false;
  private _inputActive = false;
  private onSendMessage: ((msg: string) => void) | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'chat-ui';
    this.injectStyles();
    this.buildUI();
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('chat-styles')) return;
    const s = document.createElement('style');
    s.id = 'chat-styles';
    s.textContent = `
      #chat-ui {
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 400px;
        max-height: 300px;
        display: none;
        flex-direction: column;
        font-family: 'Courier New', monospace;
        z-index: 500;
      }
      #chat-ui.visible { display: flex; }
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px 4px 0 0;
        padding: 8px;
        max-height: 200px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .chat-message {
        font-size: 12px;
        line-height: 1.4;
        color: #e0e0e0;
        word-wrap: break-word;
      }
      .chat-message .chat-name {
        font-weight: bold;
        color: #88ccff;
        margin-right: 4px;
      }
      .chat-message .chat-text {
        color: #e0e0e0;
      }
      .chat-input-wrap {
        display: none;
        background: rgba(0, 0, 0, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-top: none;
        border-radius: 0 0 4px 4px;
        padding: 8px;
      }
      .chat-input-wrap.active { display: block; }
      .chat-input {
        width: 100%;
        padding: 6px 8px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        color: #fff;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        outline: none;
      }
      .chat-input:focus {
        border-color: rgba(100, 160, 255, 0.6);
        background: rgba(255, 255, 255, 0.15);
      }
      .chat-hint {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.3);
        margin-top: 4px;
        text-align: center;
      }
      .chat-messages::-webkit-scrollbar { width: 6px; }
      .chat-messages::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
      .chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
    `;
    document.head.appendChild(s);
  }

  private buildUI(): void {
    this.container.innerHTML = `
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-wrap" id="chat-input-wrap">
        <input type="text" class="chat-input" id="chat-input" maxlength="200" placeholder="Type message..." />
        <div class="chat-hint">Press Enter to send, Esc to close</div>
      </div>
    `;
    this.messagesContainer = this.container.querySelector('#chat-messages')!;
    this.input = this.container.querySelector('#chat-input') as HTMLInputElement;

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendMessage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeInput();
      }
    });
  }

  show(): void {
    this._visible = true;
    this.container.classList.add('visible');
  }

  hide(): void {
    this._visible = false;
    this.container.classList.remove('visible');
    this.closeInput();
  }

  isVisible(): boolean {
    return this._visible;
  }

  isInputActive(): boolean {
    return this._inputActive;
  }

  openInput(): void {
    if (!this._visible) return;
    this._inputActive = true;
    const wrap = this.container.querySelector('#chat-input-wrap')!;
    wrap.classList.add('active');
    this.input.value = '';
    this.input.focus();
  }

  closeInput(): void {
    this._inputActive = false;
    const wrap = this.container.querySelector('#chat-input-wrap');
    if (wrap) wrap.classList.remove('active');
    this.input.blur();
  }

  addMessage(playerName: string, message: string): void {
    const msg: ChatMessage = {
      playerName,
      message,
      timestamp: Date.now(),
    };
    this.messages.push(msg);

    // Keep last 50 messages
    if (this.messages.length > 50) {
      this.messages.shift();
    }

    this.renderMessages();
  }

  private renderMessages(): void {
    this.messagesContainer.innerHTML = '';
    for (const msg of this.messages) {
      const div = document.createElement('div');
      div.className = 'chat-message';
      div.innerHTML = `<span class="chat-name">${this.escapeHtml(msg.playerName)}:</span><span class="chat-text">${this.escapeHtml(msg.message)}</span>`;
      this.messagesContainer.appendChild(div);
    }
    // Auto-scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private sendMessage(): void {
    const text = this.input.value.trim();
    if (text && this.onSendMessage) {
      this.onSendMessage(text);
      this.input.value = '';
    }
    this.closeInput();
  }

  setSendCallback(cb: (msg: string) => void): void {
    this.onSendMessage = cb;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

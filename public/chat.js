class ChatApp {
  constructor() {
    // DOM elements
    this.chatMessages = document.getElementById("chat-messages");
    this.userInput = document.getElementById("user-input");
    this.sendButton = document.getElementById("send-button");
    this.typingIndicator = document.getElementById("typing-indicator");
    this.modelSelect = document.getElementById("model-select");
    this.temperatureInput = document.getElementById("temperature-input");
    this.topKInput = document.getElementById("topK-input");
    this.topPInput = document.getElementById("topP-input");

    // Chat state
    this.chatHistory = [];
    this.isProcessing = false;

    // Initialize event listeners and display initial message
    this.initEventListeners();
    this.displayInitialMessage();
  }

  initEventListeners() {
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.userInput.addEventListener("input", () => this.resizeInput());
  }

  displayInitialMessage() {
    this.addMessageToChat(
      "assistant",
      "Hello! I'm an LLM chat app powered by both Workers AI and the Gemini API. How can I help you today?"
    );
  }

  addMessageToChat(role, content) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${role}-message`;
    messageEl.innerHTML = `<p>${content}</p>`;
    this.chatMessages.appendChild(messageEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  resizeInput() {
    this.userInput.style.height = "auto";
    this.userInput.style.height = `${this.userInput.scrollHeight}px`;
  }

  async sendMessage() {
    const message = this.userInput.value.trim();
    if (!message || this.isProcessing) return;

    this.isProcessing = true;
    this.userInput.disabled = true;
    this.sendButton.disabled = true;

    this.addMessageToChat("user", message);
    this.chatHistory.push({ role: "user", content: message });
    
    this.userInput.value = "";
    this.userInput.style.height = "auto";

    this.typingIndicator.classList.add("visible");

    try {
      const assistantMessageEl = document.createElement("div");
      assistantMessageEl.className = "message assistant-message";
      assistantMessageEl.innerHTML = "<p></p>";
      this.chatMessages.appendChild(assistantMessageEl);

      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

      const selectedModel = this.modelSelect.value;
      const apiMessages = this.chatHistory.filter((msg) => msg.role !== "system");

      // Gather advanced parameters
      const params = {
        model: selectedModel,
        messages: apiMessages,
        temperature: parseFloat(this.temperatureInput.value),
        topK: parseInt(this.topKInput.value),
        topP: parseFloat(this.topPInput.value),
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = "";

      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          responseText += chunk;
          assistantMessageEl.querySelector("p").textContent = responseText;
          this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }
      
      this.chatHistory.push({ role: "assistant", content: responseText });
    } catch (error) {
      console.error("Error:", error);
      this.addMessageToChat("assistant", "Sorry, there was an error processing your request.");
    } finally {
      this.typingIndicator.classList.remove("visible");
      this.isProcessing = false;
      this.userInput.disabled = false;
      this.sendButton.disabled = false;
      this.userInput.focus();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});

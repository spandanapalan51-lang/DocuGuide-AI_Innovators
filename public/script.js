
document.addEventListener("DOMContentLoaded", () => {
  // Footer year
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Mobile navigation
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("active");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ========================
  // LOGIN AND REGISTRATION
  // ========================

  const authForm = document.getElementById("authForm");
  const showLoginButton = document.getElementById("showLogin");
  const showRegisterButton = document.getElementById("showRegister");
  const authTitle = document.getElementById("authTitle");
  const authDescription = document.getElementById("authDescription");
  const authSubmit = document.getElementById("authSubmit");
  const nameField = document.getElementById("nameField");
  const authName = document.getElementById("authName");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const agree = document.getElementById("agree");
  const loginMessage =
    document.getElementById("loginMessage") ||
    document.getElementById("loginMsg");

  let authMode = "login";

  function setAuthMode(mode) {
    authMode = mode;

    const isRegister = mode === "register";

    if (nameField) nameField.hidden = !isRegister;
    if (authName) authName.required = isRegister;

    if (authTitle) {
      authTitle.textContent = isRegister
        ? "Create your account."
        : "Welcome back.";
    }

    if (authDescription) {
      authDescription.textContent = isRegister
        ? "Register to save and revisit your troubleshooting conversations."
        : "Log in to continue to DocuGuide AI.";
    }

    if (authSubmit) {
      authSubmit.textContent = isRegister ? "Create Account" : "Login";
    }

    if (authPassword) {
      authPassword.autocomplete = isRegister
        ? "new-password"
        : "current-password";
    }

    if (showLoginButton) {
      showLoginButton.classList.toggle("btn-primary", !isRegister);
      showLoginButton.classList.toggle("btn-light", isRegister);
      showLoginButton.setAttribute("aria-pressed", String(!isRegister));
    }

    if (showRegisterButton) {
      showRegisterButton.classList.toggle("btn-primary", isRegister);
      showRegisterButton.classList.toggle("btn-light", !isRegister);
      showRegisterButton.setAttribute("aria-pressed", String(isRegister));
    }

    if (loginMessage) loginMessage.textContent = "";
  }

  showLoginButton?.addEventListener("click", () => setAuthMode("login"));
  showRegisterButton?.addEventListener("click", () => setAuthMode("register"));

  if (authForm) {
    setAuthMode("login");

    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (loginMessage) loginMessage.textContent = "";

      if (agree && !agree.checked) {
        if (loginMessage) {
          loginMessage.textContent =
            "Please accept the demo safety notice to continue.";
        }
        return;
      }

      const email = authEmail?.value.trim() || "";
      const password = authPassword?.value || "";
      const name = authName?.value.trim() || "";

      if (!email || !password) {
        if (loginMessage) {
          loginMessage.textContent = "Please enter your email and password.";
        }
        return;
      }

      if (authMode === "register" && !name) {
        if (loginMessage) loginMessage.textContent = "Please enter your name.";
        authName?.focus();
        return;
      }

      if (password.length < 8 || password.length > 128) {
        if (loginMessage) {
          loginMessage.textContent =
            "Password must be between 8 and 128 characters.";
        }
        return;
      }

      const endpoint =
        authMode === "register"
          ? "/api/auth/register"
          : "/api/auth/login";

      const originalButtonText = authSubmit?.textContent || "Continue";

      if (authSubmit) {
        authSubmit.disabled = true;
        authSubmit.textContent = "Please wait...";
      }

      try {
        const payload = { email, password };

        if (authMode === "register") {
          payload.name = name;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Authentication failed.");
        }

        if (!data.token || !data.user) {
          throw new Error("The server did not return a valid login session.");
        }

        // Keep the session for this browser tab.
        sessionStorage.setItem("docuguideToken", data.token);
        sessionStorage.setItem("docuguideDemoName", data.user.name);

        if (loginMessage) {
          loginMessage.textContent = data.message || "Success!";
        }

        window.location.href = "guidance.html";
      } catch (error) {
        if (loginMessage) {
          loginMessage.textContent =
            error.message || "Could not connect to the server.";
        }
      } finally {
        if (authSubmit) {
          authSubmit.disabled = false;
          authSubmit.textContent = originalButtonText;
        }
      }
    });
  }

  // ========================
  // LEGACY DEMO-ONLY LOGIN
  // Kept for any older page that still uses loginForm.
  // ========================

  const legacyLoginForm = document.getElementById("loginForm");
  const userNameInput = document.getElementById("userName");

  function showChat(name) {
    const welcomeMessage = document.getElementById("welcomeMessage");
    const loginSection = document.getElementById("loginSection");
    const chatSection = document.getElementById("chatSection");
    const messages = document.getElementById("messages");
    const chatInput = document.getElementById("chatInput");

    if (welcomeMessage) {
      welcomeMessage.textContent =
        `Hi ${name}! Welcome to DocuGuide AI. What document issue can I help with?`;
    }

    if (loginSection && chatSection) {
      loginSection.hidden = true;
      chatSection.hidden = false;
    }

    if (messages) {
      messages.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    chatInput?.focus();
  }

  if (legacyLoginForm) {
    legacyLoginForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = userNameInput?.value.trim();
      const legacyAgree = document.getElementById("agree");

      if (!name) {
        if (loginMessage) loginMessage.textContent = "Please enter your name.";
        userNameInput?.focus();
        return;
      }

      if (legacyAgree && !legacyAgree.checked) {
        if (loginMessage) {
          loginMessage.textContent = "Please agree to continue to the demo.";
        }
        return;
      }

      sessionStorage.setItem("docuguideDemoName", name);

      if (document.getElementById("messages")) {
        showChat(name);
      } else {
        window.location.href = "guidance.html";
      }
    });
  }

  // ========================
  // CHATBOT
  // ========================

  const messages = document.getElementById("messages");
  const chatInput = document.getElementById("chatInput");
  const chatForm = document.getElementById("chatForm");

  function addMessage(type, text) {
    if (!messages) return;

    const bubble = document.createElement("div");

    bubble.className =
      type === "user"
        ? "user-message bubble user"
        : "bot-message bubble bot";

    // textContent prevents returned text from being interpreted as HTML.
    bubble.textContent = String(text ?? "");
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  // Restore greeting
  const savedName = sessionStorage.getItem("docuguideDemoName");
  const welcomeMessage = document.getElementById("welcomeMessage");

  if (savedName && welcomeMessage) {
    welcomeMessage.textContent =
      `Hi ${savedName}! Welcome to DocuGuide AI. What document issue can I help with?`;
  }

  // Load saved history for logged-in users.
  async function loadChatHistory() {
    const token = sessionStorage.getItem("docuguideToken");

    if (!token || !messages) return;

    try {
      const response = await fetch("/api/chats", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        sessionStorage.removeItem("docuguideToken");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Could not load chat history.");
      }

      if (Array.isArray(data.chats) && data.chats.length > 0) {
        // API returns newest first; display oldest first.
        data.chats.slice().reverse().forEach((chat) => {
          addMessage("user", chat.message);
          addMessage("bot", chat.reply);
        });
      }
    } catch (error) {
      console.error("Chat history error:", error);
    }
  }

  if (messages) {
    loadChatHistory();
  }

  // Send message to the existing Gemini backend.
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const text = chatInput.value.trim();
      if (!text) return;

      if (text.length > 1000) {
        addMessage("bot", "Please keep your message to 1000 characters or fewer.");
        return;
      }

      addMessage("user", text);
      chatInput.value = "";

      const sendButton = chatForm.querySelector(
        'button[type="submit"], input[type="submit"]'
      );

      chatInput.disabled = true;
      if (sendButton) sendButton.disabled = true;

      let loadingBubble = null;

      if (messages) {
        loadingBubble = document.createElement("div");
        loadingBubble.className = "bot-message bubble bot";
        loadingBubble.textContent = "Thinking...";
        messages.appendChild(loadingBubble);
        messages.scrollTop = messages.scrollHeight;
      }

      try {
        const headers = {
          "Content-Type": "application/json"
        };

        const token = sessionStorage.getItem("docuguideToken");

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch("/api/troubleshoot", {
          method: "POST",
          headers,
          body: JSON.stringify({ message: text })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401 && token) {
            sessionStorage.removeItem("docuguideToken");
          }

          throw new Error(
            data.error || `The request failed (HTTP ${response.status}).`
          );
        }

        if (!data.reply) {
          throw new Error("The AI returned an empty response.");
        }

        loadingBubble?.remove();
        loadingBubble = null;
        addMessage("bot", data.reply);
      } catch (error) {
        console.error("DocuGuide chat error:", error);

        loadingBubble?.remove();

        addMessage(
          "bot",
          `Sorry, I couldn't get an AI response. ${
            error.message || "Please check that your server is running."
          }`
        );
      } finally {
        chatInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        chatInput.focus();
      }
    });
  }

  // Suggested questions
  document.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!chatInput || !chatForm) return;

      chatInput.value =
        button.dataset.suggestion || button.textContent.trim();

      chatForm.requestSubmit();
    });
  });

  // ========================
  // CONTACT FORM
  // ========================

  const contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const name =
        document.getElementById("contactName")?.value.trim() || "";
      const email =
        document.getElementById("contactEmail")?.value.trim() || "";
      const message =
        document.getElementById("contactMessage")?.value.trim() || "";

      const contactMessage = document.getElementById("contactMsg");

      const subject = encodeURIComponent("DocuGuide AI feedback");
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
      );

      if (contactMessage) {
        contactMessage.textContent =
          "Opening your email app to prepare the message...";
      }

      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    });
  }
});

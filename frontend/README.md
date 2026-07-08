# LG AI Production Intelligence Chatbox

An AI-powered, real-time factory production intelligence platform and chatbox. This system enables plant heads, product managers, and operations teams to query live and historical production metrics using natural language, voice commands, and file inputs, paired with predictive analytics for end-of-day targets.

---

## 🚀 Features

### 1. Core Analytics & Dashboards

* **Main & Live Dashboards:** Real-time visibility into factory lines, tracking plans vs. actual targets.
* **Predictive Analytics:** Built-in Machine Learning (`scikit-learn` Linear Regression models) projecting end-of-day production results based on current intra-day trajectories.
* **Interactive Visualizations:** Rich, responsive charts and trend graphs powered by `Recharts`.
* **Report Generation:** Direct-to-PDF compilation (`jsPDF`) for instant executive reporting.

### 2. AI Chatbox & RAG Pipeline

* **Retrieval-Augmented Generation (RAG):** Natural language querying over active SQLite production databases.
* **Hybrid LLM Support:** Integrated with Google GenAI SDK alongside local fallback capabilities utilizing Ollama (`llama3.2:1b`).
* **Multi-Modal Inputs:** Supports voice-to-text queries and document context parsing.

### 3. Enterprise Guardrails

* **API Security:** Rate-limiting via `SlowAPI` to prevent abuse.
* **Session Management:** Secure token-based routing and protected page views.
* **Resiliency:** Robust centralized error logging system capturing and categorizing backend/DB issues.

---

## 🛠️ Tech Stack

### Backend

* **Framework:** FastAPI (Python)
* **Database:** SQLite (`production.db`)
* **AI/ML:** Google GenAI SDK, Ollama (`llama3.2:1b`), Scikit-Learn
* **Security & Utilities:** SlowAPI, Dotenv, SMTP (Email Alerts)

### Frontend

* **Framework:** React 18 (TypeScript)
* **Build Tool:** Vite
* **Styling:** Tailwind CSS (Customized LG Premium System Theme)
* **Icons & Charts:** Lucide React, Recharts

---

## 📁 Repository Structure

```text
├── backend/
│   ├── app.py                  # FastAPI main entry point & routing
│   ├── database.py             # SQLite configuration and schema operations
│   ├── generator.py            # Live snapshot and real-time data generator
│   ├── rag.py                  # RAG pipeline for natural language to SQL queries
│   ├── ml.py                   # Linear Regression predictive training and analytics
│   ├── auth.py                 # Backend authentication utilities
│   ├── settings.py             # Global environment configurations
│   └── requirements.txt        # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Shared UI Components (Header, ProtectedRoute)
│   │   ├── pages/
│   │   │   ├── MainDashboard.tsx      # Overview performance panel
│   │   │   ├── LiveDashboardPage.tsx  # Real-time line tracking & data stream
│   │   │   └── AIChatboxPage.tsx     # Voice, file, and text conversational AI
│   │   ├── api.ts              # Axios/Fetch API client layer for FastAPI communication
│   │   └── main.tsx            # Application entry point
│   └── package.json            # Node.js dependencies
│
└── scripts/
    ├── start.bat               # Windows single-click environment launcher
    └── start.sh                # Linux/macOS shell startup script

```

---

## ⚙️ Installation & Setup

### Prerequisites

* Python 3.10+
* Node.js 18+
* *(Optional)* [Ollama](https://ollama.com/) (For local LLM execution)

### 1. Environment Configuration

Create a `.env` file in the root backend directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
SECRET_KEY=your_jwt_signing_secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SENDER=your-email@example.com
EMAIL_PASSWORD=your-app-password

```

### 2. Automated Launch (Recommended)

You can fire up both the frontend and backend servers concurrently using the provided automated wrappers.

* **Windows:**
```bash
./scripts/start.bat

```


* **Linux / macOS:**
```bash
chmod +x ./scripts/start.sh
./scripts/start.sh

```



### 3. Manual Installation

#### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
python generate_all.py    # Seed initial database records
uvicorn app:app --reload --port 8000

```

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev

```

The client application will open locally at `http://localhost:5173`.

---

## 📊 Testing & Quality Assurance

The system has undergone a full system QA walkthrough ensuring data schema type safety across bounds:

* Validated complete asynchronous WebSocket data streams for live factory snapshot modifications.
* Verified backend pipeline error capturing (`below_threshold` logic handling edge cases cleanly).
* To trigger manual system testing diagnostics, run:
```bash
python backend/test_troubleshoot.py

```

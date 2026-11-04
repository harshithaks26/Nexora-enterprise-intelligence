# NEXORA – Enterprise Intelligence Platform

**An AI-powered enterprise knowledge assistant combining Retrieval-Augmented Generation (RAG), multi-agent workflows, and Model Context Protocol (MCP).**

## Overview

NEXORA is an Enterprise Intelligence Platform designed to help users interact with organizational knowledge through natural language.

It combines Large Language Models (LLMs), Retrieval-Augmented Generation (RAG), LangGraph-based workflows, and MCP tools to provide context-aware responses, retrieve information from documents, and perform tool-assisted tasks.

Users can upload PDF documents, ask questions, retrieve relevant information, and interact with the system through a conversational interface.

## Key Features

- **Retrieval-Augmented Generation (RAG):** Retrieves relevant information from uploaded documents before generating responses.
- **LLM Integration:** Uses locally hosted LLMs through Ollama.
- **Multi-Agent Workflow:** Uses LangGraph to coordinate different processing steps.
- **Model Context Protocol (MCP):** Integrates external tools through MCP.
- **PDF Ingestion:** Extracts and processes information from PDF documents.
- **Vector Search:** Uses PostgreSQL with pgvector for storing and retrieving document embeddings.
- **Conversational Memory:** Supports contextual conversations and follow-up questions.
- **Web Search:** Supports web search-based information retrieval.
- **React Interface:** Provides an interactive chat experience.

## Technology Stack

| Category | Technologies |
|---|---|
| Programming Language | Python, JavaScript |
| Frontend | React, Vite |
| Backend | FastAPI |
| LLM | Ollama, Qwen 2.5 |
| AI Workflow | LangGraph |
| AI Integration | LangChain |
| Protocol | Model Context Protocol (MCP) |
| Embeddings | Sentence Transformers |
| Vector Database | PostgreSQL, pgvector |
| Database | PostgreSQL |
| Containerization | Docker |
| API | REST API |

## System Architecture

1. **User Interaction:** Users interact with NEXORA through the React-based interface.
2. **API Layer:** FastAPI receives user queries and manages requests.
3. **Workflow Orchestration:** LangGraph coordinates the execution of the workflow.
4. **Knowledge Retrieval:** The RAG component retrieves relevant document chunks using vector similarity search.
5. **Tool Integration:** MCP enables the system to interact with available tools.
6. **Response Generation:** The locally hosted LLM generates context-aware responses.
7. **Response Delivery:** The generated response is returned to the frontend.

## Project Structure

```text
NEXORA/
│
├── app/                  # FastAPI application and API routes
├── core/                 # LLM, embeddings and text processing
├── db/                   # Database models and repositories
├── graph/                # LangGraph workflow and nodes
├── ingestion/            # PDF and web ingestion
├── mcp_server/           # MCP server and client
├── scripts/              # Utility scripts
├── tests/                # Test cases
├── frontend-react/       # React frontend
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pytest.ini
└── .gitignore
```

## Installation and Setup

### Prerequisites

- Python 3.10 or compatible version
- Node.js and npm
- Docker Desktop
- Ollama

### 1. Clone the Repository

```bash
git clone https://github.com/harshithaks26/Nexora-enterprise-intelligence.git
cd Nexora-enterprise-intelligence
```

### 2. Set Up Python Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Set Up Ollama

Install Ollama and download the model:

```bash
ollama pull qwen2.5:7b
```

Make sure Ollama is running before starting the backend.

### 4. Start PostgreSQL with pgvector

```bash
docker compose up -d db
```

Configure the required environment variables in your local `.env` file. Refer to `.env.example` if available.

### 5. Start the Backend

From the project root:

```bash
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend documentation:

http://localhost:8000/docs

### 6. Start the Frontend

Open another terminal:

```bash
cd frontend-react
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

http://localhost:5173/

## Usage

1. Start the backend, database, and frontend.
2. Open the NEXORA web interface.
3. Upload PDF documents when document-based knowledge retrieval is needed.
4. Ask questions using natural language.
5. Receive context-aware responses through the AI workflow.
6. Continue the conversation with follow-up questions.

## Future Enhancements

- Enhanced multi-agent collaboration.
- Additional MCP tool integrations.
- Improved document retrieval and ranking.
- Enterprise authentication and role-based access control.
- Expanded document format support.
- Deployment to cloud infrastructure.

## Author

**Harshitha K S**

GitHub: [@harshithaks26](https://github.com/harshithaks26)

---

**NEXORA – Turning Enterprise Knowledge into Intelligence.**

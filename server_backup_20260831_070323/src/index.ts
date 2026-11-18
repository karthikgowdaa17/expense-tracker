import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface ClientMessage {
  type: string;
  payload: any;
  requestId?: string;
}

interface Client {
  ws: WebSocket;
  projectId?: string;
  workflowId?: string;
}

const clients = new Map<WebSocket, any>();

// Simple in-memory event bus
const eventBus = {
  listeners: [] as Function[],
  subscribe(listener: (event: any) => void) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  },
  publish(event: any) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('EventBus listener error', e);
      }
    }
  }
};

const clients = new Map<WebSocket, any>();

function broadcastEvent(event: any) {
  const message = JSON.stringify({ type: 'event', payload: event });
  for (const [ws] of clients) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(message);
    }
  }
}

// Simple in-memory event bus
const eventBus = {
  listeners: [] as Function[],
  subscribe(listener: Function) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  },
  publish(event: any) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('EventBus listener error', e);
      }
    }
  }
};

// Subscribe to event bus and broadcast to all clients
// eventBus.subscribe((event) => {
//   const message = JSON.stringify({ type: 'event', payload: event });
//   for (const [ws] of clients) {
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify({ type: 'event', payload: event }));
//     }
//   });
// });

const clients = new Map<WebSocket, any>();

async function handleMessage(ws: WebSocket, message: any) {
  const client = clients.get(ws);
  if (!client) return;

  switch (message.type) {
    case 'hello':
      ws.send(JSON.stringify({ type: 'welcome', payload: { message: 'Connected to KD Workscape Orchestrator' } }));
      break;

    case 'sync':
      if (message.payload?.projectId) {
        // const project = await orchestrator.getProject(message.payload.projectId);
        ws.send(JSON.stringify({ type: 'sync', payload: { project: null } }));
      }
      break;

    case 'createProject':
      try {
        // const project = await orchestrator.createProject(message.payload.command);
        ws.send(JSON.stringify({ type: 'projectCreated', payload: { project: null } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'startWorkflow':
      try {
        // await orchestrator.startWorkflow(message.payload.projectId);
        ws.send(JSON.stringify({ type: 'workflowStarted', payload: { projectId: message.payload.projectId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'startAgentTask':
      try {
        // await orchestrator.startAgentTask(message.payload.agentId, message.payload.taskId);
        ws.send(JSON.stringify({ type: 'taskStarted', payload: { taskId: message.payload.taskId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'submitQAResult':
      try {
        // await orchestrator.submitQAResult(message.payload.taskId, message.payload.passed, message.payload.feedback);
        ws.send(JSON.stringify({ type: 'qaResultSubmitted', payload: { taskId: message.payload.taskId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'advanceStage':
      break;

    case 'requestApproval':
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown message type: ${message.type}` } }));
  }
}

async function handleMessage(ws: WebSocket, message: any) {
  const client = clients.get(ws);
  if (!client) return;

  switch (message.type) {
    case 'hello':
      ws.send(JSON.stringify({ type: 'welcome', payload: { message: 'Connected to KD Workscape Orchestrator' } }));
      break;

    case 'sync':
      if (message.payload?.projectId) {
        // const project = await orchestrator.getProject(message.payload.projectId);
        ws.send(JSON.stringify({ type: 'sync', payload: { project: null } }));
      }
      break;

    case 'createProject':
      try {
        // const project = await orchestrator.createProject(message.payload.command);
        ws.send(JSON.stringify({ type: 'projectCreated', payload: { project: null } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'startWorkflow':
      try {
        // await orchestrator.startWorkflow(message.payload.projectId);
        ws.send(JSON.stringify({ type: 'workflowStarted', payload: { projectId: message.payload.projectId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'startAgentTask':
      try {
        // await orchestrator.startAgentTask(message.payload.agentId, message.payload.taskId);
        ws.send(JSON.stringify({ type: 'taskStarted', payload: { taskId: message.payload.taskId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'submitQAResult':
      try {
        // await orchestrator.submitQAResult(message.payload.taskId, message.payload.passed, message.payload.feedback);
        ws.send(JSON.stringify({ type: 'qaResultSubmitted', payload: { taskId: message.payload.taskId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'advanceStage':
      break;

    case 'requestApproval':
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown message type: ${message.type}` } }));
  }
}

// Simple in-memory event bus
const eventBus = {
  listeners: [] as Function[],
  subscribe(listener: (event: any) => void) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  },
  publish(event: any) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('EventBus listener error', e);
      }
    }
  }
};

// Subscribe to event bus and broadcast to all clients
eventBus.subscribe((event) => {
  const message = JSON.stringify({ type: 'event', payload: event });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'event', payload: event }));
    }
  }
});

const clients = new Map<WebSocket, any>();

async function handleMessage(ws: WebSocket, message: any) {
  const client = clients.get(ws);
  if (!client) return;

  switch (message.type) {
    case 'hello':
      ws.send(JSON.stringify({ type: 'welcome', payload: { message: 'Connected to KD Workscape Orchestrator' } }));
      break;

    case 'sync':
      if (message.payload?.projectId) {
        // const project = await orchestrator.getProject(message.payload.projectId);
        ws.send(JSON.stringify({ type: 'sync', payload: { project: null } }));
      }
      break;

    case 'createProject':
      try {
        // const project = await orchestrator.createProject(message.payload.command);
        ws.send(JSON.stringify({ type: 'projectCreated', payload: { project: null } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'startWorkflow':
      try {
        // await orchestrator.startWorkflow(message.payload.projectId);
        ws.send(JSON.stringify({ type: 'workflowStarted', payload: { projectId: message.payload.projectId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'startAgentTask':
      try {
        // await orchestrator.startAgentTask(message.payload.agentId, message.payload.taskId);
        ws.send(JSON.stringify({ type: 'taskStarted', payload: { taskId: message.payload.taskId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'submitQAResult':
      try {
        // await orchestrator.submitQAResult(message.payload.taskId, message.payload.passed, message.payload.feedback);
        ws.send(JSON.stringify({ type: 'qaResultSubmitted', payload: { taskId: message.payload.taskId } }));
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
      }
      break;

    case 'advanceStage':
      break;

    case 'requestApproval':
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', payload: { message: `Unknown message type: ${message.type}` } }));
  }
}

// Subscribe to event bus and broadcast to all clients
eventBus.subscribe((event) => {
  const message = JSON.stringify({ type: 'event', payload: event });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'event', payload: event }));
    }
  }
});

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.set(ws, {});
  console.log('[WS] Client connected');

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(ws, message);
    } catch (error) {
      console.error('[WS] Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', payload: { message: String(error) } }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[WS] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });
});

const server = createServer();
const wss = new WebSocketServer({ server });

server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptimeMs: process.uptime() * 1000, wsClients: 0 }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(8080, () => {
  console.log('[Server] HTTP + WS server running on http://localhost:8080');
  console.log('[Server] WebSocket available at ws://localhost:8080/ws');
  console.log('[Server] Health endpoint at http://localhost:8080/health');
});
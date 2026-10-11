import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MatchRecorderProvider } from './api/MatchRecorder';
import { createQueryClient } from './api/queryClient';
import { startMocks } from './mocks/browser';
import './styles/app.css';

const queryClient = createQueryClient();

async function bootstrap() {
  // The mocked REST API runs in dev, in tests and in the published build.
  await startMocks();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MatchRecorderProvider>
          <App />
        </MatchRecorderProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();

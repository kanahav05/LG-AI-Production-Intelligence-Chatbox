import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
// @ts-ignore: allow side-effect CSS import without type declarations
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
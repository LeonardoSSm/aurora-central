import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuroraHome } from './ui/AuroraHome'
import './ui/home.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuroraHome />
  </StrictMode>,
)

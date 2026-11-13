//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { eodmsExperience, naplExperience } from './experiences'

const root = document.getElementById('root')!;
const experience = root.dataset.experience === 'napl' ? naplExperience : eodmsExperience;

createRoot(root).render(
  //<StrictMode >
    <App experience={experience} />
  //</StrictMode>
  ,
)

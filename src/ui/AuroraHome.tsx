import { useState } from 'react'
import type { ModuleOpenSettled } from '../domain/events'
import { openModule } from '../domain/launcher'
import { modules } from '../domain/registry'
import { moduleNotice } from '../domain/state'
import { ParticleCore } from '../graphics/ParticleCore'
import type { GraphicsSettings } from '../graphics/profiles'

export function AuroraHome({ settings }: { settings: GraphicsSettings }) {
  const [selection, setSelection] = useState<ModuleOpenSettled | null>(null)
  const selectedModule = modules.find((module) => module.id === selection?.moduleId)

  return (
    <main className="home">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1 className="brand-name" aria-label="Aurora Central">Aurora</h1>
        <p className="brand-detail">Ecosystem</p>
      </header>

      <section className="scene" aria-label="Ecossistema Aurora">
        <div className="orbit" aria-hidden="true" />
        <ParticleCore state="idle" settings={settings} />
        <ul className="module-list" aria-label="Módulos Aurora">
          {modules.map((module) => (
            <li key={module.id} className={`module-slot ${module.anchor} module-${module.id}`}>
              <button
                className="module"
                type="button"
                aria-label={`Aurora ${module.name}`}
                aria-describedby={module.availability === 'unavailable' ? 'module-availability' : undefined}
                onClick={() => setSelection(openModule({ type: 'module.open', moduleId: module.id }))}
              >
                <span className="module-icon" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <span className="module-name"><small>Aurora</small>{module.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="home-footer">
        <p id="module-availability" className="sr-only">Abertura de aplicativos indisponível nesta versão.</p>
        <p className="status" role="status">
          {selection && selectedModule ? <><strong>Aurora {selectedModule.name}</strong><span>{moduleNotice(selection)}</span></> : null}
        </p>
        <a href="#/nucleo" className="core-link home-core-link">Demonstração do núcleo</a>
      </footer>
    </main>
  )
}

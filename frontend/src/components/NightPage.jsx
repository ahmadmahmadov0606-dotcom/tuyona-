import PageBackground from './PageBackground'
import './NightPage.css'

// usePageHidden ҳоло дар PageBackground аст; барои воридоти кӯҳна аз ин ҷо низ дастрас
export { usePageHidden } from './PageBackground'

/**
 * Wrapper-и саҳифаҳои торик (/qonun, /listing/:id): фосилаҳо ва ранги матн.
 * Худи замина — ҷузъи ягонаи PageBackground.
 */
export default function NightPage({ className = '', children }) {
  return (
    <div className={`night-page ${className}`}>
      <PageBackground />
      {children}
    </div>
  )
}

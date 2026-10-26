import { CATEGORY_CREDITS } from '../categoryCredits'

/** Муаллифон ва иҷозатномаҳои аксҳо (талаби CC BY / CC BY-SA) */
export default function PhotoCredits() {
  return (
    <div className="container page narrow">
      <div className="page-head">
        <h1>Аксҳо</h1>
        <p className="muted">Аксҳои категорияҳо аз Wikimedia Commons бо иҷозатномаҳои озод. Андоза ва формат тағйир дода шудааст.</p>
      </div>
      <div className="table-wrap box">
        <table className="table">
          <thead><tr><th>Категория</th><th>Муаллиф</th><th>Иҷозатнома</th><th>Манбаъ</th></tr></thead>
          <tbody>
            {CATEGORY_CREDITS.map((c) => (
              <tr key={c.slug}>
                <td>{c.category}</td>
                <td>{c.author}</td>
                <td>{c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">{c.license}</a> : c.license}</td>
                <td><a href={c.page} target="_blank" rel="noopener noreferrer">{c.title}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

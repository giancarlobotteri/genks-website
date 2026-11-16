import Link from 'next/link';
import { CinematicHero } from './cinematic-hero';
import { HomeAssistantButton } from './home-console';
import { getPublicDiscounts } from '@/lib/public-discounts-server';
import { homeStorefront } from '@/lib/home-storefront';
import { serviceAmount } from '@/lib/service-rates';
import styles from './service-home.module.css';

export async function ServiceHome() {
  const catalog = homeStorefront(await getPublicDiscounts());
  const price = (id: string) => serviceAmount(catalog.find(item => item.id === id)!.price);
  const paths = [
    { title: 'Voglio solo registrare', href: '/services/recording', detail: price('recording') + '/ora · minimo prenotazione 20 €' },
    { title: 'Ho già registrato il brano', href: '/services#servizi', detail: 'Mix o master da ' + price('mix') },
    { title: 'Voglio fare un brano da zero', href: '/services#brano-da-zero', detail: 'Beat su misura da ' + price('custom') },
    { title: 'Ho un budget di…', href: '/services/budget', detail: 'Confronta i servizi nella tua fascia di prezzo' },
  ];
  return <div className={styles.home}>
    <CinematicHero serviceLanding/>
    <section id="percorsi" className={styles.customerPaths} aria-labelledby="home-paths">
      <h2 id="home-paths">Da dove vuoi partire?</h2>
      <div className={styles.pathGrid}>
        {paths.map(path => <a key={path.href} href={path.href}><strong>{path.title}</strong><small>{path.detail}</small></a>)}
        <HomeAssistantButton/>
      </div>
    </section>
  </div>;
}

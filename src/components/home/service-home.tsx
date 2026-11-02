import {getPublicDiscounts} from '@/lib/public-discounts-server';
import {CinematicHero} from './cinematic-hero';
import styles from './service-home.module.css';
export async function ServiceHome(){
 const discounts=await getPublicDiscounts();
 return <div className={`${styles.home} ${styles.cinematicHome}`}><CinematicHero serviceLanding discounts={discounts}/></div>;
}

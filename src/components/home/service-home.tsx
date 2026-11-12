import {CinematicHero} from './cinematic-hero';
import styles from './service-home.module.css';
export function ServiceHome(){
 return <div className={`${styles.home} ${styles.cinematicHome}`}><CinematicHero serviceLanding/></div>;
}

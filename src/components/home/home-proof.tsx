import Image from "next/image";
import { audioComparisons, artistReviews } from "@/data/home-content";
import { AudioComparison } from "./audio-comparison";
import styles from "./service-home.module.css";
export function HomeProof() {
 const comparisons = audioComparisons.filter(item => item.before && item.after).slice(0, 3);
 const reviews = artistReviews.filter(item => item.artist && item.photo && item.quote && item.songUrl);
 return <>{comparisons.length > 0 && <section id="lavori" className={styles.section}><h2>ASCOLTA LA DIFFERENZA</h2><div className={styles.proofGrid}>{comparisons.map(item => <AudioComparison key={item.id} item={item} />)}</div></section>}
 {reviews.length >= 3 && <section className={styles.section}><h2>RECENSIONI</h2><div className={styles.proofGrid}>{reviews.map(item => <article key={item.id} className={styles.proofCard}><Image src={item.photo} width={72} height={72} alt={item.artist} /><h3>{item.artist}</h3><blockquote>{item.quote}</blockquote><a href={item.songUrl} target="_blank" rel="noopener noreferrer">Ascolta il brano</a></article>)}</div></section>}</>;
}

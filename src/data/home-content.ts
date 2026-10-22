export type AudioComparison = { id: string; title: string; artist: string; genre: string; before: string; after: string };
export type ArtistReview = { id: string; artist: string; photo: string; quote: string; songUrl: string };
// Solo materiali reali con autorizzazione alla pubblicazione. File in public/ o Storage Supabase.
export const audioComparisons: AudioComparison[] = [];
export const artistReviews: ArtistReview[] = [];
export const studioPortrait: string | null = null;
export const genksBiography = "Sono Gianca, in arte GENKS. Produco e mixo rap, trap e R&B nel mio studio a Perugia. Lavoro su ogni brano come se fosse mio: ascolto i tuoi riferimenti e ti porto dove vuoi arrivare.";

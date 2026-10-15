export const catalogGenres = ["Trap", "R&B", "Afro", "Reggae", "Pop", "Rap/HipHop", "Experimental", "Drill"] as const;
export const catalogMoods = ["Dark", "Floating", "Melodic", "Hard"] as const;
export const catalogKeys = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"].flatMap(note => [`${note} min`, `${note} maj`]);

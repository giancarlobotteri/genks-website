"use client";
import {ArrowUpRight} from 'lucide-react';
import {AssistantAvatar} from '../layout/assistant-avatar';
import styles from './home-console.module.css';

export function HomeAssistantButton() {
  return <button className={styles.assistant} type="button" aria-haspopup="dialog"
    onClick={()=>window.dispatchEvent(new Event('genks:open-chat'))}>
    <AssistantAvatar size={38}/>
    <span><strong>Hai domande? Chiedi all’assistente!</strong><small>Servizi, prezzi e disponibilità</small></span>
    <ArrowUpRight size={20} aria-hidden="true"/>
  </button>;
}

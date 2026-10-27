import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogAnswer,currentPricingKnowledge} from '../src/lib/chatbot/catalog.ts';
import {knownAnswer} from '../src/lib/chatbot/answers.ts';
import {homeStorefront} from '../src/lib/home-storefront.ts';
import {serviceAmount} from '../src/lib/service-rates.ts';
test('assistant catalog uses storefront prices and real package savings',()=>{const text=catalogAnswer();for(const c of homeStorefront()){assert.ok(text.includes(serviceAmount(c.price)));assert.ok(text.includes(c.href));if(c.saving)assert.ok(text.includes(serviceAmount(c.saving)));}assert.match(currentPricingKnowledge(),/2,00/);});
test('catalog, contact storage and payment questions have verified answers',()=>{assert.match(knownAnswer('Quali servizi offrite?')!,/29,99/);assert.match(knownAnswer('Quali pacchetti avete?')!,/69,97/);assert.match(knownAnswer('Come salvo i miei dati?')!,/email verificata/);assert.match(knownAnswer('Come funziona l’acconto?')!,/10 €.*9,99/);assert.match(knownAnswer('fammi uno sconto sui pacchetti')!,/Non posso trattare/);});

"use client";
import {useEffect} from 'react';
import {serviceCartKey} from '@/lib/service-cart-storage';
export function CompletedServiceCart({requestId}:{requestId:string}){useEffect(()=>{void serviceCartKey().then(base=>{for(const key of [base,base+':direct']){try{const request=JSON.parse(sessionStorage.getItem(key+':request')??'null');if(request?.id===requestId){sessionStorage.removeItem(key);sessionStorage.removeItem(key+':request');}}catch{}}window.dispatchEvent(new Event('genks-services-cart'));});},[requestId]);return null;}

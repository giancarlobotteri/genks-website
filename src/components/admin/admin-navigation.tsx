"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Disc3, FileCheck2, ShoppingBag, Users, CalendarDays, SlidersHorizontal, KeyRound, Tag, ChartNoAxesCombined, Settings, Mail } from "lucide-react";
const links = [
  {title:"Cerca prenotazione / pagamento",href:"/admin/search",icon:ShoppingBag},
  {title:"Panoramica",href:"/admin",icon:LayoutDashboard}, {title:"Beat",href:"/admin/beats",icon:Disc3},
  {title:"Licenze",href:"/admin/licenses",icon:FileCheck2}, {title:"Ordini",href:"/admin/orders",icon:ShoppingBag},
  {title:"Clienti",href:"/admin/customers",icon:Users}, {title:"Prenotazioni",href:"/admin/bookings",icon:CalendarDays},
  {title:"Mix & Master",href:"/admin/projects",icon:SlidersHorizontal}, {title:"Esclusiva",href:"/admin/exclusive",icon:KeyRound},
  {title:"Promozioni",href:"/admin/promotions",icon:Tag}, {title:"Vendite",href:"/admin/analytics",icon:ChartNoAxesCombined},
  {title:"Assistenza",href:"/admin/support",icon:Mail}, {title:"Recessi e rimborsi",href:"/admin/withdrawals",icon:FileCheck2}, {title:"Impostazioni",href:"/admin/settings",icon:Settings},
];
export function AdminNavigation() {
  const path=usePathname();
  return <nav aria-label="Amministrazione GENKS">{links.map(item=><Link key={item.href} href={item.href} aria-current={path===item.href?"page":undefined}><item.icon size={18} aria-hidden="true"/><span>{item.title}</span></Link>)}</nav>;
}


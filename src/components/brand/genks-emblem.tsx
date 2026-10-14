import Image from "next/image";

export function GenksEmblem() {
  return <div className="genks-emblem" aria-hidden="true">
    <div className="genks-emblem-model">
      <i className="genks-emblem-orbit orbit-one" />
      <i className="genks-emblem-orbit orbit-two" />
      <i className="genks-emblem-orbit orbit-three" />
      <div className="genks-emblem-core"><Image src="/brand/genks-header.svg" alt="" width={130} height={64} /></div>
    </div>
  </div>;
}

import { AudioEngine } from '../src/services/audioEngine';

const e = AudioEngine.getInstance();

const casos: Array<[number, number]> = [
  [0, 0], [10, 10], [20, 20], [23, 20], [25, 30], [47, 50], [87, 90], [100, 100],
  [110, 100], [-5, 0], [Number.NaN, 0],
];

let ok = true;
console.log('volumen predeterminado:', e.getDuckingVolume(), e.getDuckingVolume() === 0 ? 'OK' : 'FALLA');
if (e.getDuckingVolume() !== 0) ok = false;

for (const [entrada, esperado] of casos) {
  e.setDuckingVolume(entrada);
  const salida = e.getDuckingVolume();
  const bien = salida === esperado;
  if (!bien) ok = false;
  console.log(`  setDuckingVolume(${entrada}) -> ${salida}%  ${bien ? 'OK' : `FALLA (esperaba ${esperado})`}`);
}

// El motor tambien debe avisar el volumen elegido al atenuar
e.setDuckingEnabled(true);
e.setDuckingVolume(40);
let aviso: { ducked: boolean; vol: number } | null = null;
e.setDuckingCallback((ducked, vol) => { aviso = { ducked, vol }; });
e.startDucking(15);
console.log('al atenuar avisa:', JSON.stringify(aviso));
if (!aviso || (aviso as any).vol !== 40) { console.log('FALLA: el callback no recibio 40%'); ok = false; }
e.stopDucking();

console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
process.exit(ok ? 0 : 1);

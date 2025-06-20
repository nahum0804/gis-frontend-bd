import React, { useEffect, useState } from 'react';

export default function CurrentLocation() {
  const [pos, setPos] = useState<[number, number] | null>(null);
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPos([coords.latitude, coords.longitude]),
      console.error
    );
  }, []);
  return (
    <div className="Card">
      <h4>Mi ubicación</h4>
      {pos ? (
        <p>{pos[0].toFixed(5)}, {pos[1].toFixed(5)}</p>
      ) : (
        <p>Cargando...</p>
      )}
    </div>
  );
}

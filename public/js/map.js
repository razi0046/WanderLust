console.log(mapToken);
console.log("lat:",latitude,"long:",longitude);
mapboxgl.accessToken = mapToken;
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [latitude,longitude],
    zoom: 9,
});

const coordinates=[latitude,longitude];
const marker= new mapboxgl.Marker({color : "red"})
.setLngLat(coordinates)
.setPopup(
    new mapboxgl.Popup({ offset : 25}).setHTML( `<p> Exact Location Will Be Provided After Booking </p>`)
)
.addTo(map);
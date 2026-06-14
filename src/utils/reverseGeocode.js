const formatAddressFromNominatim = (data = {}) => {
  const address = data.address || {};

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    "";

  const postcode = address.postcode || "";
  const country = address.country || "";

  const parts = [];

  if (city) {
    parts.push(city);
  }

  if (country) {
    parts.push(country);
  }

  let formattedAddress = parts.join(", ");

  if (postcode) {
    formattedAddress = formattedAddress
      ? `${formattedAddress} ${postcode}`
      : postcode;
  }

  return formattedAddress || data.display_name || "";
};

const reverseGeocodeCoordinates = async (latitude, longitude) => {
  try {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return "";
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=en`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "NeighborScout/1.0",
      },
    });

    if (!response.ok) {
      return "";
    }

    const data = await response.json();

    return formatAddressFromNominatim(data);
  } catch (error) {
    console.log("Reverse Geocode Error:", error);
    return "";
  }
};

module.exports = {
  reverseGeocodeCoordinates,
};
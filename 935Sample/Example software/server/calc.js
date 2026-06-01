async function loadData() {
  try {
    const response = await fetch('https://tries-hiv-formula-medline.trycloudflare.com/users');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Failed to load JSON:", error);
  }
}
loadData();

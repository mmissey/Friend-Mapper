<?php
header('Content-Type: application/json');
$file = 'json/cities.json';
$newCities = $_POST['newCities'];
$data = json_decode(file_get_contents($file),1);
foreach($newCities as $cityName => $value){
	$data[$cityName] = $value;
}
file_put_contents($file, json_encode($data));
?>
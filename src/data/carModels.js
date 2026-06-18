// carModels.js
//
// Dataset that powers the scroll-to-select car model picker on the booking page.
// Vietnam-market-focused: the makes and models most commonly seen on Vietnamese
// roads are listed first and most thoroughly, followed by popular global and
// premium brands, then emerging Chinese brands now sold in Vietnam. A generic
// "Other" make is included last as a fallback for anything not covered.
//
// Pure ES module — no imports, no dependencies.

export const CAR_MAKES = [
  // ----- Vietnam-priority mass-market makes -----
  {
    make: 'Toyota',
    models: [
      'Vios',
      'Corolla Altis',
      'Camry',
      'Innova',
      'Fortuner',
      'Yaris',
      'Wigo',
      'Avanza',
      'Veloz',
      'Raize',
      'Land Cruiser',
      'Hilux',
      'Corolla Cross',
      'Rush',
      'Hiace',
    ],
  },
  {
    make: 'Hyundai',
    models: [
      'Accent',
      'Grand i10',
      'Elantra',
      'Tucson',
      'Santa Fe',
      'Creta',
      'Kona',
      'Stargazer',
      'Custin',
      'Palisade',
      'SantaCruz',
    ],
  },
  {
    make: 'Kia',
    models: [
      'Morning',
      'Soluto',
      'K3',
      'Cerato',
      'Seltos',
      'Sonet',
      'Sportage',
      'Sorento',
      'Carnival',
      'Carens',
    ],
  },
  {
    make: 'Honda',
    models: ['City', 'Civic', 'Accord', 'CR-V', 'HR-V', 'BR-V', 'Brio', 'Jazz'],
  },
  {
    make: 'Mazda',
    models: ['Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-8', 'BT-50'],
  },
  {
    make: 'Ford',
    models: [
      'Ranger',
      'Everest',
      'Territory',
      'EcoSport',
      'Explorer',
      'Transit',
      'Ranger Raptor',
    ],
  },
  {
    make: 'Mitsubishi',
    models: [
      'Attrage',
      'Xpander',
      'Xpander Cross',
      'Outlander',
      'Pajero Sport',
      'Triton',
      'Xforce',
    ],
  },
  {
    make: 'VinFast',
    models: [
      'Fadil',
      'Lux A2.0',
      'Lux SA2.0',
      'VF 3',
      'VF 5',
      'VF 6',
      'VF 7',
      'VF 8',
      'VF 9',
      'VF e34',
      'President',
    ],
  },
  {
    make: 'Suzuki',
    models: ['Swift', 'Ciaz', 'Ertiga', 'XL7', 'Jimny', 'Celerio'],
  },
  {
    make: 'Nissan',
    models: ['Almera', 'Navara', 'Kicks', 'X-Trail', 'Terra'],
  },
  {
    make: 'Isuzu',
    models: ['D-Max', 'mu-X'],
  },
  {
    make: 'Chevrolet',
    models: ['Spark', 'Aveo', 'Cruze', 'Colorado', 'Captiva', 'Trailblazer'],
  },
  {
    make: 'MG',
    models: ['MG5', 'MG ZS', 'MG HS', 'MG RX5'],
  },
  {
    make: 'Peugeot',
    models: ['2008', '3008', '5008', '408'],
  },

  // ----- Premium / luxury makes -----
  {
    make: 'Mercedes-Benz',
    models: [
      'C-Class',
      'E-Class',
      'S-Class',
      'GLC',
      'GLE',
      'GLB',
      'GLA',
      'GLS',
      'A-Class',
    ],
  },
  {
    make: 'BMW',
    models: [
      '2 Series',
      '3 Series',
      '4 Series',
      '5 Series',
      '7 Series',
      'X1',
      'X3',
      'X5',
      'X6',
      'X7',
    ],
  },
  {
    make: 'Audi',
    models: ['A4', 'A6', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8'],
  },
  {
    make: 'Lexus',
    models: ['ES', 'LS', 'IS', 'NX', 'RX', 'GX', 'LX', 'LM'],
  },
  {
    make: 'Land Rover',
    models: [
      'Range Rover',
      'Range Rover Sport',
      'Range Rover Velar',
      'Range Rover Evoque',
      'Discovery',
      'Discovery Sport',
      'Defender',
    ],
  },
  {
    make: 'Porsche',
    models: ['Macan', 'Cayenne', 'Panamera', '911', 'Taycan', 'Cayman', 'Boxster'],
  },
  {
    make: 'Volvo',
    models: ['S60', 'S90', 'XC40', 'XC60', 'XC90', 'V60', 'V90'],
  },
  {
    make: 'Volkswagen',
    models: ['Polo', 'Passat', 'Tiguan', 'Touareg', 'Teramont', 'Virtus', 'T-Cross'],
  },
  {
    make: 'MINI',
    models: ['Cooper', 'Clubman', 'Countryman', 'Cooper SE'],
  },
  {
    make: 'Subaru',
    models: ['Forester', 'Outback', 'XV', 'WRX', 'BRZ'],
  },

  // ----- Emerging Chinese brands now sold in Vietnam -----
  {
    make: 'BYD',
    models: ['Atto 3', 'Dolphin', 'Seal', 'Han', 'Tang'],
  },
  {
    make: 'Wuling',
    models: ['HongGuang MiniEV', 'Bingo'],
  },
  {
    make: 'Haval',
    models: ['H6', 'Jolion'],
  },
  {
    make: 'Chery',
    models: ['Omoda 5', 'Tiggo 7', 'Tiggo 8'],
  },
  {
    make: 'GAC',
    models: ['GS3', 'GS8', 'M8', 'Aion Y', 'Aion ES'],
  },
  {
    make: 'Lynk & Co',
    models: ['01', '03', '05', '06', '09'],
  },

  // ----- Fallback -----
  {
    make: 'Other',
    models: ['Other'],
  },
];

// Flat list of "Make Model" strings for quick lookup / typeahead in the picker,
// excluding the generic "Other" make.
export const CAR_MODEL_OPTIONS = CAR_MAKES.flatMap((entry) =>
  entry.make === 'Other'
    ? []
    : entry.models.map((model) => `${entry.make} ${model}`),
);

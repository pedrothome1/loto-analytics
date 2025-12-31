import { CoreModule } from './core.js';
import { FiltersModule } from './filters.js';
import { UiModule } from './ui.js';
import { StatsModule } from './stats.js';
import { GeneratorModule } from './generator.js';
import { SimulationModule } from './simulation.js';

const { createApp } = Vue;

createApp({
  mixins: [
    CoreModule,
    FiltersModule,
    UiModule,
    StatsModule,
    GeneratorModule,
    SimulationModule
  ]
}).mount('#app');

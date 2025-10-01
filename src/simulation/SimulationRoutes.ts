import { Router, Request, Response } from 'express';
import { SimulationController } from './SimulationController';
import { SimulationConfig } from './EventSimulator';

export class SimulationRoutes {
  private router: Router;
  private simulationController: SimulationController;

  constructor() {
    this.router = Router();
    this.simulationController = new SimulationController();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Obtener estado de la simulación
    this.router.get('/status', (req: Request, res: Response) => {
      try {
        const status = this.simulationController.getSimulationStatus();
        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error obteniendo estado de simulación'
        });
      }
    });

    // Iniciar simulación
    this.router.post('/start', (req: Request, res: Response) => {
      try {
        const { config } = req.body;
        console.log('🎭 Intentando iniciar simulación con config:', config);
        const success = this.simulationController.startSimulation(config);
        
        if (success) {
          console.log('✅ Simulación iniciada exitosamente');
          res.json({
            success: true,
            message: 'Simulación iniciada correctamente'
          });
        } else {
          console.log('❌ Error iniciando simulación');
          res.status(400).json({
            success: false,
            error: 'No se pudo iniciar la simulación'
          });
        }
      } catch (error) {
        console.error('❌ Error iniciando simulación:', error);
        res.status(500).json({
          success: false,
          error: 'Error iniciando simulación'
        });
      }
    });

    // Detener simulación
    this.router.post('/stop', (req: Request, res: Response) => {
      try {
        const success = this.simulationController.stopSimulation();
        res.json({
          success: true,
          message: 'Simulación detenida correctamente'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error deteniendo simulación'
        });
      }
    });

    // Pausar simulación
    this.router.post('/pause', (req: Request, res: Response) => {
      try {
        const success = this.simulationController.pauseSimulation();
        if (success) {
          res.json({
            success: true,
            message: 'Simulación pausada correctamente'
          });
        } else {
          res.json({
            success: false,
            message: 'La simulación ya estaba pausada'
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error pausando simulación'
        });
      }
    });

    // Reanudar simulación
    this.router.post('/resume', (req: Request, res: Response) => {
      try {
        const success = this.simulationController.resumeSimulation();
        if (success) {
          res.json({
            success: true,
            message: 'Simulación reanudada correctamente'
          });
        } else {
          res.json({
            success: false,
            message: 'La simulación ya estaba activa'
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error reanudando simulación'
        });
      }
    });

    // Generar evento único
    this.router.post('/generate-event', (req: Request, res: Response) => {
      try {
        const { eventType } = req.body;
        console.log('🎲 Generando evento único:', eventType);
        const event = this.simulationController.generateSingleEvent(eventType);
        
        if (event) {
          console.log('✅ Evento generado exitosamente:', event.type);
          res.json({
            success: true,
            data: event,
            message: 'Evento generado correctamente'
          });
        } else {
          console.log('❌ Error generando evento');
          res.status(400).json({
            success: false,
            error: 'No se pudo generar el evento'
          });
        }
      } catch (error) {
        console.error('❌ Error generando evento:', error);
        res.status(500).json({
          success: false,
          error: 'Error generando evento'
        });
      }
    });

    // Actualizar configuración
    this.router.put('/config', (req: Request, res: Response) => {
      try {
        const { config } = req.body;
        
        if (!config || typeof config !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Configuración inválida'
          });
        }

        const success = this.simulationController.updateSimulationConfig(config);
        
        if (success) {
          return res.json({
            success: true,
            message: 'Configuración actualizada correctamente',
            data: this.simulationController.getSimulationStatus().config
          });
        } else {
          return res.status(400).json({
            success: false,
            error: 'Error actualizando configuración'
          });
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Error actualizando configuración'
        });
      }
    });

    // Reiniciar simulación
    this.router.post('/reset', (req: Request, res: Response) => {
      try {
        const success = this.simulationController.resetSimulation();
        res.json({
          success: true,
          message: 'Simulación reiniciada correctamente'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error reiniciando simulación'
        });
      }
    });

    // Obtener información disponible
    this.router.get('/info', (req: Request, res: Response) => {
      try {
        const info = {
          eventTypes: this.simulationController.getAvailableEventTypes(),
          severities: this.simulationController.getAvailableSeverities(),
          cameras: this.simulationController.getAvailableCameras()
        };
        
        res.json({
          success: true,
          data: info
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error obteniendo información de simulación'
        });
      }
    });

    // Obtener estadísticas
    this.router.get('/stats', (req: Request, res: Response) => {
      try {
        const stats = {
          eventCount: this.simulationController.getEventCount(),
          isActive: this.simulationController.isSimulationActive(),
          isConnected: this.simulationController.isConnectedToNotificationService()
        };
        
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Error obteniendo estadísticas'
        });
      }
    });
  }

  public getRouter(): Router {
    return this.router;
  }

  public getSimulationController(): SimulationController {
    return this.simulationController;
  }
}

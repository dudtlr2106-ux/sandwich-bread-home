local capabilities = require "st.capabilities"
local Driver = require "st.driver"
local protocol = require "kocom_protocol"

-- This 1st-stage driver is deliberately TX-safe.
-- Handlers validate the SmartThings command, then the protocol gate rejects it
-- until a matching packet is documented as CONFIRMED.

local function blocked_tx(device, command_key, args)
  local packet, err = protocol.encode_or_reject(command_key, args)
  if packet == nil then
    device.log.warn(err)
    return
  end

  -- Intentionally no LAN/RS485 send implementation in this stage.
  -- Add transport only after packet confirmation and explicit review.
  device.log.warn("Confirmed packet exists but transport is intentionally not implemented yet")
end

local capability_handlers = {
  [capabilities.switch.ID] = {
    [capabilities.switch.commands.on.NAME] = function(_, device)
      blocked_tx(device, "switch.on", {})
    end,
    [capabilities.switch.commands.off.NAME] = function(_, device)
      blocked_tx(device, "switch.off", {})
    end,
  },
  [capabilities.thermostatHeatingSetpoint.ID] = {
    [capabilities.thermostatHeatingSetpoint.commands.setHeatingSetpoint.NAME] = function(_, device, command)
      blocked_tx(device, "heating.setHeatingSetpoint", { value = command.args.setpoint })
    end,
  },
  [capabilities.fanSpeed.ID] = {
    [capabilities.fanSpeed.commands.setFanSpeed.NAME] = function(_, device, command)
      blocked_tx(device, "ventilation.setFanSpeed", { value = command.args.fanSpeed })
    end,
  },
}

local driver = Driver("ourhome-kocom", {
  capability_handlers = capability_handlers,
})

driver:run()

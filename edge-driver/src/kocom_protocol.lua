-- KOCOM raw packet gate.
-- IMPORTANT: do not add guessed or reverse-engineered packets here.
-- Only packets explicitly marked CONFIRMED in docs/kocom_protocol.md may be added.

local protocol = {}

local CONFIRMED_PACKETS = {
  -- Intentionally empty until docs/kocom_protocol.md contains confirmed packets.
}

function protocol.encode_or_reject(command_key, args)
  local encoder = CONFIRMED_PACKETS[command_key]
  if encoder == nil then
    return nil, "KOCOM TX blocked: packet is not confirmed in docs/kocom_protocol.md"
  end
  return encoder(args)
end

return protocol

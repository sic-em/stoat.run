package edge

type Config struct {
	Port               int
	BaseDomain         string
	ControlPlaneURL    string
	ControlPlaneSecret string
	OverlayDir         string
	OverlayEventSalt   string
	OverlayDebugRaw    bool
	MaxBodySize        int64
	RateLimitRPS       float64
	LogLevel           string
}
